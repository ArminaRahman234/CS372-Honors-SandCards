// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

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

    // 1. Save room session record in PostgreSQL via Prisma
    await prisma.room.create({
      data: {
        roomId: roomCode,
        hostKey: hostKey,
        tableState: { deck: [], players: [], status: 'waiting' },
      },
    });

    // 2. Save in-memory active session for real-time socket tracking
    const newRoom = {
      code: roomCode,
      hostKey: hostKey,
      createdAt: new Date(),
      players: [],
      gameState: null,
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

// Real-time Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Event: Player joins a room
  socket.on('join_room', ({ roomCode, username }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error_message', 'Room not found.');
      return;
    }

    // Join the Socket.io room channel
    socket.join(roomCode);

    // Track player in the room memory
    const newPlayer = { id: socket.id, username: username || 'Anonymous' };
    const existingPlayer = room.players.find((p) => p.id === socket.id);

    if (!existingPlayer) {
      room.players.push(newPlayer);
    }

    console.log(`${newPlayer.username} (${socket.id}) joined room ${roomCode}`);

    // Broadcast updated player list to all clients in this room
    io.to(roomCode).emit('room_updated', {
      roomCode: room.code,
      players: room.players,
    });
  });

  // Event: Handle socket disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove player from active rooms
    rooms.forEach((room, roomCode) => {
      const index = room.players.findIndex((p) => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomCode).emit('room_updated', {
          roomCode: room.code,
          players: room.players,
        });
      }
    });
  });
});

// Start the server using server.listen
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});