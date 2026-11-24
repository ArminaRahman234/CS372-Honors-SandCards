// client/src/components/Lobby.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Export shared socket instance
export const socket = io('http://localhost:4000');

function getRoomCodeFromPath() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{4,10})\/?$/);
  return match ? match[1].toUpperCase() : '';
}

export default function Lobby() {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState(() => getRoomCodeFromPath());
  const [savedPreview, setSavedPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on('error_message', (msg) => {
      setError(msg);
      setLoading(false);
    });

    return () => {
      socket.off('error_message');
    };
  }, []);

  // If user navigated directly to /room/:roomId, query backend/PostgreSQL to restore & preview state
  useEffect(() => {
    const pathCode = getRoomCodeFromPath();
    if (!pathCode) return;

    let cancelled = false;
    fetch(`http://localhost:4000/api/rooms/${pathCode}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Saved room not found.');
        }
        if (!cancelled) {
          setSavedPreview(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a display name first.');
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
      setError('Please enter both a display name and room code.');
      return;
    }

    setError(null);
    setLoading(true);

    socket.emit('join_room', {
      roomCode: joinCode.trim().toUpperCase(),
      username: username.trim(),
    });
  };

  const savedPlayerNames = savedPreview?.gameState?.savedPlayers
    ? Object.keys(savedPreview.gameState.savedPlayers)
    : [];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SandCards</h1>
          <p className="text-sm text-slate-500">
            Real-time multiplayer tabletop card sandbox
          </p>
        </div>

        {savedPreview && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <div className="font-semibold text-emerald-800">
              Saved Session Loaded: Room {savedPreview.roomCode}
            </div>
            <div>
              Deck: {savedPreview.gameState?.deck?.length ?? 0} cards • Table:{' '}
              {savedPreview.gameState?.tableCards?.length ?? 0} cards
            </div>
            {savedPlayerNames.length > 0 && (
              <div>
                Saved seats: <strong>{savedPlayerNames.join(', ')}</strong> (enter your exact name to restore your hand & score)
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
            Display Name
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name (e.g., host)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <form onSubmit={handleJoinRoom} className="space-y-2.5">
          <label htmlFor="roomCode" className="block text-sm font-medium text-slate-700">
            Join or Resume by Room Code
          </label>
          <div className="flex gap-2">
            <input
              id="roomCode"
              type="text"
              value={joinCode}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const urlMatch = raw.match(/\/room\/([A-Za-z0-9]{4,10})/i);
                setJoinCode((urlMatch ? urlMatch[1] : raw).toUpperCase().slice(0, 6));
              }}
              placeholder="e.g. 8306F3 or room link"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {savedPreview ? 'Resume Room' : 'Join Room'}
            </button>
          </div>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink mx-3 text-xs uppercase text-slate-400">or</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? 'Creating Room...' : 'Create New Table'}
        </button>
      </div>
    </div>
  );
}