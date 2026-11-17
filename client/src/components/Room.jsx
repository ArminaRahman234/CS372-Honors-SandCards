import React, { useEffect } from 'react';
import { socket } from './Lobby';

export default function Room({ roomData, onLeaveRoom }) {
  useEffect(() => {
    const handleKicked = (message) => {
      alert(message);
      onLeaveRoom();
    };

    const handleError = (message) => {
      alert(message);
    };

    const handleSaved = ({ message }) => {
      alert(message);
    };

    socket.on('kicked', handleKicked);
    socket.on('error_message', handleError);
    socket.on('session_saved', handleSaved);

    return () => {
      socket.off('kicked', handleKicked);
      socket.off('error_message', handleError);
      socket.off('session_saved', handleSaved);
    };
  }, [onLeaveRoom]);

  const { roomCode, players, gameState } = roomData;
  const myHand = gameState?.hands?.[socket.id] || [];
  const deckCount = gameState?.deck?.length ?? 0;
  const tableCards = gameState?.tableCards || [];

  const handleShuffle = () => socket.emit('shuffle_deck', { roomCode });
  const handleDeal = () => socket.emit('deal_cards', { roomCode, count: 5 });
  const handleReset = () => socket.emit('reset_game', { roomCode });

  const handlePlayCard = (cardId) => {
    // Place played cards at a slight random offset so they don't stack identically
    const randomX = Math.floor(Math.random() * 200) - 100;
    const randomY = Math.floor(Math.random() * 100) - 50;
    socket.emit('play_card', { roomCode, cardId, x: randomX, y: randomY });
  };

  const handleFlipCard = (cardId) => {
    socket.emit('flip_card', { roomCode, cardId });
  };

  const handlePickupCard = (cardId) => {
    socket.emit('pickup_card', { roomCode, cardId });
  };

  const handleDrawCard = () => socket.emit('draw_card', { roomCode });

  const handleAssignDealer = (targetPlayerId) => {
    const hostKey = localStorage.getItem(`hostKey_${roomCode}`);
    socket.emit('assign_dealer', { roomCode, hostKey, targetPlayerId });
  };

  const handleScoreChange = (targetPlayerId, delta) => {
    socket.emit('update_score', { roomCode, targetPlayerId, delta });
  };

  const handleSaveSession = () => {
    const hostKey = localStorage.getItem(`hostKey_${roomCode}`);
    socket.emit('save_session', { roomCode, hostKey });
  };

  const handleKickPlayer = (targetPlayerId) => {
    const hostKey = localStorage.getItem(`hostKey_${roomCode}`);
    socket.emit('kick_player', { roomCode, hostKey, targetPlayerId });
  };

  return (
    <div className="room-session" style={{ padding: '20px' }}>
      <h2>Room Code: {roomCode}</h2>
      <button onClick={onLeaveRoom}>Leave Room</button>

      <h3>Players Connected ({players.length}):</h3>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            {p.username} {p.id === socket.id ? '(You)' : ''} {roomData.dealerId === p.id ? '[Dealer]' : ''} — Cards in hand:{' '}
            {gameState?.handCounts?.[p.id] ?? gameState?.hands?.[p.id]?.length ?? 0} | Score: {gameState?.scores?.[p.id] ?? 0}{' '}
            (<button onClick={() => handleScoreChange(p.id, 1)}>+1</button> /{' '}
            <button onClick={() => handleScoreChange(p.id, -1)}>-1</button>){' '}
            {localStorage.getItem(`hostKey_${roomCode}`) && roomData.dealerId !== p.id && (
              <button onClick={() => handleAssignDealer(p.id)}>[Make Dealer]</button>
            )}
            {localStorage.getItem(`hostKey_${roomCode}`) && p.id !== socket.id && (
              <button onClick={() => handleKickPlayer(p.id)}>[Kick]</button>
            )}
          </li>
        ))}
      </ul>

      <hr />

      <div>
        <strong>Deck Remaining:</strong> {deckCount} cards
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          <button onClick={handleShuffle}>Shuffle Deck</button>
          <button onClick={handleDeal}>Deal 5 Cards</button>
          <button onClick={handleDrawCard}>Draw 1 Card</button>
          <button onClick={handleReset}>Reset Table</button>
          {localStorage.getItem(`hostKey_${roomCode}`) && (
              <button onClick={handleSaveSession}>Save Session</button>
          )}
        </div>
      </div>

      <hr />

      <div>
        <h3>Your Hand ({myHand.length}):</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {myHand.map((card) => (
            <button key={card.id} onClick={() => handlePlayCard(card.id)}>
              Play {card.id} ({card.suit})
            </button>
          ))}
        </div>
      </div>

      <hr />

      <div>
        <h3>Table Cards ({tableCards.length}):</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tableCards.map((card) => (
            <span key={card.id} style={{ display: 'inline-flex', gap: '4px' }}>
              <button onClick={() => handleFlipCard(card.id)}>
                {card.faceUp ? `${card.id} (Face Up)` : '🂠 Face Down'} [Flip]
              </button>
              <button onClick={() => handlePickupCard(card.id)}>[Pick Up]</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}