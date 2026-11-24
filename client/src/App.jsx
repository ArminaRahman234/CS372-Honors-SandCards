// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import { socket } from './components/Lobby'; // Import shared socket instance
import Room from './components/Room';
import './index.css';

export default function App() {
  const [roomData, setRoomData] = useState(null);
  const [mySocketId, setMySocketId] = useState(() => socket.id || '');

  useEffect(() => {
    const syncSocketId = () => setMySocketId(socket.id || '');
    socket.on('connect', syncSocketId);

    // Keep listener active for all incoming room updates (joins/leaves/kicks)
    socket.on('room_updated', (data) => {
      setMySocketId(socket.id || '');
      if (data?.roomCode && window.location.pathname !== `/room/${data.roomCode}`) {
        window.history.replaceState(null, '', `/room/${data.roomCode}`);
      }
      setRoomData((prev) => ({
        ...prev,
        ...data,
        gameState: data.gameState ?? prev?.gameState,
      }));
    });

    // Listen for live card/table state changes (shuffle, deal, play, move, flip, reset)
    socket.on('game_state_updated', (updatedGameState) => {
      setRoomData((prev) => (prev ? { ...prev, gameState: updatedGameState } : prev));
    });

    return () => {
      socket.off('connect', syncSocketId);
      socket.off('room_updated');
      socket.off('game_state_updated');
    };
  }, []);

  const handleLeaveRoom = () => {
    if (roomData?.roomCode) {
      socket.emit('leave_room', { roomCode: roomData.roomCode });
    }
    window.history.replaceState(null, '', '/');
    setRoomData(null);
    window.location.reload();
  };

  return (
    <main className="app-container">
      {!roomData ? (
        <Lobby />
      ) : (
        <Room
          roomData={roomData}
          mySocketId={mySocketId}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </main>
  );
}