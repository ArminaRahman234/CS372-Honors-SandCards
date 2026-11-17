// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import { socket } from './components/Lobby'; // Import shared socket instance
import Room from './components/Room';
import './index.css';

export default function App() {
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    // Keep listener active for all incoming room updates (joins/leaves)
    socket.on('room_updated', (data) => {
      setRoomData(data);
    });

    // Listen for live card/table state changes (shuffle, deal, play, move, flip, reset)
    socket.on('game_state_updated', (updatedGameState) => {
      setRoomData((prev) => (prev ? { ...prev, gameState: updatedGameState } : prev));
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_state_updated');
    };
  }, []);

  const handleLeaveRoom = () => {
    setRoomData(null);
    window.location.reload();
  };

  return (
    <main className="app-container">
      {!roomData ? (
        <Lobby />
      ) : (
        <Room roomData={roomData} onLeaveRoom={handleLeaveRoom} />
      )}
    </main>
  );
}