// client/src/components/Lobby.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Export shared socket instance
export const socket = io('http://localhost:4000');

export default function Lobby() {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only listen for room errors inside Lobby
    socket.on('error_message', (msg) => {
      setError(msg);
      setLoading(false);
    });

    return () => {
      socket.off('error_message');
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:4000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to create room.');
      }

      const data = await response.json();
      if (data.hostKey) {
        localStorage.setItem(`hostKey_${data.roomCode}`, data.hostKey);
      }

      // Emit socket event to join created room
      socket.emit('join_room', {
        roomCode: data.roomCode,
        username: username.trim(),
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim() || !joinCode.trim()) {
      setError('Please enter both a username and room code.');
      return;
    }

    setError(null);
    setLoading(true);

    socket.emit('join_room', {
      roomCode: joinCode.trim().toUpperCase(),
      username: username.trim(),
    });
  };

  return (
    <div className="lobby-container">
      <h2>SandCards Lobby</h2>

      {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}

      <div className="form-group">
        <label htmlFor="username">Username: </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter display name"
        />
      </div>

      <hr />

      <div className="actions">
        <button onClick={handleCreateRoom} disabled={loading}>
          {loading ? 'Creating...' : 'Create New Room'}
        </button>

        <form onSubmit={handleJoinRoom} style={{ marginTop: '15px' }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter Room Code"
            maxLength={6}
          />
          <button type="submit" disabled={loading}>
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}