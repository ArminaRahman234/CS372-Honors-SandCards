// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

import {
  createInitialGameState,
  shuffleDeck,
  dealCards,
  drawCardFromDeck,
  playCardToTable,
  moveTableCard,
  flipTableCard,
  pickupCardFromTable,
} from './gameLogic.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP server wrapped around Express app
const server = http.createServer(app);

// Initialize Socket.io with CORS enabled for client-side connection
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for active room sessions
const rooms = new Map();

// Persist latest gameState snapshot to PostgreSQL via Prisma
async function saveRoomState(roomCode, gameState) {
  try {
    await prisma.room.update({
      where: { roomId: roomCode },
      data: { tableState: gameState },
    });
  } catch (error) {
    console.error(`Failed to persist state for room ${roomCode}:`, error);
  }
}



// Broadcast gameState to each player in the room while keeping other players' hands private
function broadcastGameState(roomCode, room) {
  const handCounts = {};
  for (const [playerId, cards] of Object.entries(room.gameState.hands)) {
    handCounts[playerId] = cards.length;
  }

  room.players.forEach((player) => {
    const sanitizedState = {
      ...room.gameState,
      hands: {
        [player.id]: room.gameState.hands[player.id] || [],
      },
      handCounts,
    };
    io.to(player.id).emit('game_state_updated', sanitizedState);
  });
}

// Append a timestamped entry to the room's action feed (capped at 50 entries)
function logAction(room, message) {
  if (!room.gameState.actionLog) {
    room.gameState.actionLog = [];
  }
  room.gameState.actionLog.push({
    id: crypto.randomUUID(),
    message,
    timestamp: new Date().toISOString(),
  });
  if (room.gameState.actionLog.length > 50) {
    room.gameState.actionLog.shift();
  }
}

// Helper function to generate a 6-character room code
function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g., "A3F8B1"
}

// POST /api/rooms/create endpoint
app.post('/api/rooms/create', async (req, res) => {
  try {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const hostKey = crypto.randomBytes(32).toString('hex');

    const initialState = createInitialGameState();

    // 1. Save room session record in PostgreSQL via Prisma
    await prisma.room.create({
      data: {
        roomId: roomCode,
        hostKey: hostKey,
        tableState: initialState,
      },
    });

    // 2. Save in-memory active session for real-time socket tracking
    const newRoom = {
      code: roomCode,
      hostKey: hostKey,
      hostId: null,
      dealerId: null,
      createdAt: new Date(),
      players: [],
      gameState: initialState,
    };

    rooms.set(roomCode, newRoom);

    return res.status(201).json({
      success: true,
      roomCode: newRoom.code,
      hostKey: newRoom.hostKey,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, message: 'Failed to create room' });
  }
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/rooms/:roomId — Fetch or restore a saved room session from PostgreSQL
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const roomCode = req.params.roomId.toUpperCase();

    // 1. Check active in-memory rooms first
    if (rooms.has(roomCode)) {
      const activeRoom = rooms.get(roomCode);
      return res.json({
        success: true,
        roomCode: activeRoom.code,
        players: activeRoom.players,
        hostId: activeRoom.hostId,
        dealerId: activeRoom.dealerId,
        gameState: activeRoom.gameState,
      });
    }

    // 2. Otherwise query PostgreSQL via Prisma to reconstruct the paused room
    const savedRoom = await prisma.room.findUnique({
      where: { roomId: roomCode },
    });

    if (!savedRoom) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const restoredState = {
      ...createInitialGameState(),
      ...(savedRoom.tableState || {}),
      hands: {},
      scores: {},
    };

    const restoredRoom = {
      code: savedRoom.roomId,
      hostKey: savedRoom.hostKey,
      hostId: null,
      dealerId: null,
      createdAt: savedRoom.createdAt,
      players: [],
      gameState: restoredState,
    };

    rooms.set(roomCode, restoredRoom);

    return res.json({
      success: true,
      roomCode: restoredRoom.code,
      players: restoredRoom.players,
      hostId: restoredRoom.hostId,
      dealerId: restoredRoom.dealerId,
      gameState: restoredRoom.gameState,
    });
  } catch (error) {
    console.error('Error fetching/restoring room:', error);
    return res.status(500).json({ success: false, message: 'Failed to load room state.' });
  }
});

// Real-time Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Event: Player joins a room
  socket.on('join_room', async ({ roomCode, username }) => {
    const normalizedCode = roomCode?.trim().toUpperCase();
    let room = rooms.get(normalizedCode);

    // If not in RAM (e.g., server restarted or room paused), try restoring from PostgreSQL
    if (!room && normalizedCode) {
      try {
        const savedRoom = await prisma.room.findUnique({
          where: { roomId: normalizedCode },
        });
        if (savedRoom) {
          room = {
            code: savedRoom.roomId,
            hostKey: savedRoom.hostKey,
            hostId: null,
            dealerId: null,
            createdAt: savedRoom.createdAt,
            players: [],
            gameState: {
              ...createInitialGameState(),
              ...(savedRoom.tableState || {}),
              hands: {},
              scores: {},
            },
          };
          rooms.set(normalizedCode, room);
        }
      } catch (error) {
        console.error(`Error restoring room ${normalizedCode} on join:`, error);
      }
    }

    if (!room) {
      socket.emit('error_message', 'Room not found.');
      return;
    }

    // Join the Socket.io room channel
    socket.join(normalizedCode);

    // Track player in the room memory
    const newPlayer = { id: socket.id, username: username || 'Anonymous' };
    const existingPlayer = room.players.find((p) => p.id === socket.id);

    if (!existingPlayer) {
      room.players.push(newPlayer);
      const savedData = room.gameState.savedPlayers?.[newPlayer.username];
      room.gameState.hands[socket.id] = savedData ? savedData.hand : [];
      room.gameState.scores[socket.id] = savedData ? savedData.score : 0;
      if (savedData) {
        delete room.gameState.savedPlayers[newPlayer.username];
      }
      if (!room.hostId) {
        room.hostId = socket.id;
      }
      if (!room.dealerId) {
        room.dealerId = socket.id;
      }
    }

    console.log(`${newPlayer.username} (${socket.id}) joined room ${normalizedCode}`);

    // Broadcast updated player list and game state to all clients in this room
    io.to(normalizedCode).emit('room_updated', {
      roomCode: room.code,
      players: room.players,
      hostId: room.hostId,
      dealerId: room.dealerId,
    });

    logAction(room, `${newPlayer.username} joined the room.`);

    broadcastGameState(normalizedCode, room);
  });

  // Event: Shuffle remaining deck (Dealer only)
  socket.on('shuffle_deck', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.dealerId !== socket.id) {
      socket.emit('error_message', 'Only the designated Dealer can shuffle the deck.');
      return;
    }

    shuffleDeck(room.gameState.deck);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    logAction(room, `${actor} shuffled the deck.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Deal cards to all connected players (Dealer only)
  socket.on('deal_cards', ({ roomCode, count }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.dealerId !== socket.id) {
      socket.emit('error_message', 'Only the designated Dealer can deal cards.');
      return;
    }

    const playerIds = room.players.map((p) => p.id);
    dealCards(room.gameState, playerIds, count || 5);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Dealer';
    logAction(room, `${actor} dealt ${count || 5} cards to all players.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Draw 1 card from the center deck into the player's hand
  socket.on('draw_card', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    drawCardFromDeck(room.gameState, socket.id);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    logAction(room, `${actor} drew a card.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Player plays a card from their hand onto the table
  socket.on('play_card', ({ roomCode, cardId, x, y }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    playCardToTable(room.gameState, socket.id, cardId, x, y);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    logAction(room, `${actor} played a card face-down to the table.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Drag/move an existing card on the table
  socket.on('move_card', ({ roomCode, cardId, x, y, isFinal = false }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    moveTableCard(room.gameState, cardId, x, y);
    broadcastGameState(roomCode, room);
    if (isFinal) {
      saveRoomState(roomCode, room.gameState);
    }
  });

  // Event: Flip a table card face-up / face-down
  socket.on('flip_card', ({ roomCode, cardId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    flipTableCard(room.gameState, cardId);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    const flippedCard = room.gameState.tableCards.find((c) => c.id === cardId);
    const stateText = flippedCard?.faceUp ? `revealed ${flippedCard.id}` : 'flipped a card face-down';
    logAction(room, `${actor} ${stateText}.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Reset entire table back to a fresh 52-card shuffled deck (Dealer only)
  socket.on('reset_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.dealerId !== socket.id) {
      socket.emit('error_message', 'Only the designated Dealer can reset the table.');
      return;
    }

    const freshState = createInitialGameState();
    room.players.forEach((p) => {
      freshState.hands[p.id] = [];
      freshState.scores[p.id] = 0;
    });

    room.gameState = freshState;
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    logAction(room, `${actor} reset the table.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  /// Event: Adjust a player's score in Custom Score Tracking (Dealer only)
  socket.on('update_score', ({ roomCode, targetPlayerId, delta }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.dealerId !== socket.id) {
      socket.emit('error_message', 'Only the designated Dealer can adjust scores.');
      return;
    }

    const currentScore = room.gameState.scores[targetPlayerId] ?? 0;
    room.gameState.scores[targetPlayerId] = currentScore + delta;

    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    const target = room.players.find((p) => p.id === targetPlayerId)?.username || 'a player';
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    logAction(room, `${actor} updated ${target}'s score (${sign}).`);

    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Player picks up a card from the table back into their private hand
  socket.on('pickup_card', ({ roomCode, cardId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    pickupCardFromTable(room.gameState, socket.id, cardId);
    const actor = room.players.find((p) => p.id === socket.id)?.username || 'Someone';
    logAction(room, `${actor} picked up a card from the table.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Host designates a seated player as the Dealer
  socket.on('assign_dealer', ({ roomCode, hostKey, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Verify host authentication key
    if (!hostKey || hostKey !== room.hostKey) {
      socket.emit('error_message', 'Unauthorized: Only the host can assign a dealer.');
      return;
    }

    const targetPlayer = room.players.find((p) => p.id === targetPlayerId);
    if (!targetPlayer) {
      socket.emit('error_message', 'Target player not found in room.');
      return;
    }

    room.dealerId = targetPlayerId;
    io.to(roomCode).emit('room_updated', {
      roomCode: room.code,
      players: room.players,
      hostId: room.hostId,
      dealerId: room.dealerId,
    });

    logAction(room, `${targetPlayer.username} was assigned as Dealer.`);
    broadcastGameState(roomCode, room);
  });

  // Event: Host kicks a seated player from the room
  socket.on('kick_player', ({ roomCode, hostKey, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // 1. Verify host authentication key
    if (!hostKey || hostKey !== room.hostKey) {
      socket.emit('error_message', 'Unauthorized: Only the host can kick players.');
      return;
    }

    // 2. Prevent host from kicking themselves
    if (targetPlayerId === socket.id) {
      socket.emit('error_message', 'Host cannot kick themselves.');
      return;
    }

    const index = room.players.findIndex((p) => p.id === targetPlayerId);
    if (index === -1) {
      socket.emit('error_message', 'Target player not found in room.');
      return;
    }

    const kickedName = room.players[index].username;

    // 3. Remove player from room state
    room.players.splice(index, 1);
    delete room.gameState.hands[targetPlayerId];
    delete room.gameState.scores[targetPlayerId];
    if (room.dealerId === targetPlayerId) {
      room.dealerId = null;
    }

    // 4. Notify kicked client and remove their socket from the room channel
    io.to(targetPlayerId).emit('kicked', 'You have been removed from the room by the host.');
    const targetSocket = io.sockets.sockets.get(targetPlayerId);
    if (targetSocket) {
      targetSocket.leave(roomCode);
    }

    // 5. Broadcast updated seats and game state to remaining players
    io.to(roomCode).emit('room_updated', {
      roomCode: room.code,
      players: room.players,
      hostId: room.hostId,
      dealerId: room.dealerId,
    });

    logAction(room, `${kickedName} was kicked by the host.`);
    broadcastGameState(roomCode, room);
    saveRoomState(roomCode, room.gameState);
  });

  // Event: Host explicitly saves & pauses/persists the current session snapshot
  socket.on('save_session', async ({ roomCode, hostKey }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!hostKey || hostKey !== room.hostKey) {
      socket.emit('error_message', 'Unauthorized: Only the host can save the session.');
      return;
    }

    // Snapshot each connected player's hand and score by username so they restore on rejoin
    const savedPlayers = {};
    room.players.forEach((p) => {
      savedPlayers[p.username] = {
        hand: room.gameState.hands[p.id] || [],
        score: room.gameState.scores[p.id] ?? 0,
      };
    });
    room.gameState.savedPlayers = savedPlayers;

    await saveRoomState(roomCode, room.gameState);
    logAction(room, 'Host saved the session state to database.');
    broadcastGameState(roomCode, room);
    socket.emit('session_saved', { message: 'Session saved successfully!' });
  });

  // Event: Player explicitly clicks "Leave Room"
  socket.on('leave_room', ({ roomCode }) => {
    const normalizedCode = roomCode?.trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) return;

    const index = room.players.findIndex((p) => p.id === socket.id);
    if (index !== -1) {
      const departingPlayer = room.players[index];

      if (!room.gameState.savedPlayers) {
        room.gameState.savedPlayers = {};
      }
      room.gameState.savedPlayers[departingPlayer.username] = {
        hand: room.gameState.hands[socket.id] || [],
        score: room.gameState.scores[socket.id] ?? 0,
      };

      room.players.splice(index, 1);
      delete room.gameState.hands[socket.id];
      delete room.gameState.scores[socket.id];

      if (room.hostId === socket.id) {
        room.hostId = null;
      }
      if (room.dealerId === socket.id) {
        room.dealerId = null;
      }

      socket.leave(normalizedCode);

      io.to(normalizedCode).emit('room_updated', {
        roomCode: room.code,
        players: room.players,
        hostId: room.hostId,
        dealerId: room.dealerId,
      });

      logAction(room, `${departingPlayer.username} left the room.`);
      broadcastGameState(normalizedCode, room);
      saveRoomState(normalizedCode, room.gameState);
    }
  });

  // Event: Handle socket disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove player from active rooms
    rooms.forEach((room, roomCode) => {
      const index = room.players.findIndex((p) => p.id === socket.id);
    if (index !== -1) {
      const departingPlayer = room.players[index];

      if (!room.gameState.savedPlayers) {
        room.gameState.savedPlayers = {};
      }

      room.gameState.savedPlayers[departingPlayer.username] = {
        hand: room.gameState.hands[socket.id] || [],
        score: room.gameState.scores[socket.id] ?? 0,
      };

      room.players.splice(index, 1);
      delete room.gameState.hands[socket.id];
      delete room.gameState.scores[socket.id];

      if (room.hostId === socket.id) {
        room.hostId = null;
      }
      if (room.dealerId === socket.id) {
        room.dealerId = null;
      }

      io.to(roomCode).emit('room_updated', {
        roomCode: room.code,
        players: room.players,
        hostId: room.hostId,
        dealerId: room.dealerId,
      });
      
      broadcastGameState(roomCode, room);
      saveRoomState(roomCode, room.gameState);
    }
    });
  });
});

// Start the server using server.listen
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});