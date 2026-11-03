// client/src/components/Room.jsx
import React from 'react';

export default function Room({ roomData, onLeaveRoom }) {
  return (
    <div className="room-session">
      <h2>Room Code: {roomData.roomCode}</h2>
      <h3>Players Connected ({roomData.players.length}):</h3>
      <ul>
        {roomData.players.map((p) => (
          <li key={p.id}>{p.username}</li>
        ))}
      </ul>
      <button onClick={onLeaveRoom}>Leave Room</button>
    </div>
  );
}