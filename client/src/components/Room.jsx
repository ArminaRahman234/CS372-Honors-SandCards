import React, { useEffect, useState, useRef } from 'react';
import { socket } from './Lobby';
import Table from './Table';
import Hand from './Hand';
import Scoreboard from './Scoreboard';
import ActionLog from './ActionLog';

export default function Room({ roomData, mySocketId, onLeaveRoom }) {
  const currentId = mySocketId || socket.id;
  const tableRef = useRef(null);
  const handRef = useRef(null);
  const [isHandDropTarget, setIsHandDropTarget] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [cardBack, setCardBack] = useState(
    () => localStorage.getItem('sandcards_cardBack') || 'B1'
  );
  const [dealCount, setDealCount] = useState(5);
  const [confirmKickId, setConfirmKickId] = useState(null);

  const handleCardBackChange = (e) => {
    const nextStyle = e.target.value;
    setCardBack(nextStyle);
    localStorage.setItem('sandcards_cardBack', nextStyle);
  };

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
  const hostKey = localStorage.getItem(`hostKey_${roomCode}`);
  const isHost = Boolean(hostKey);
  const myHand = gameState?.hands?.[currentId] || [];
  const deckCount = gameState?.deck?.length ?? 0;
  const tableCards = gameState?.tableCards || [];
  const isDealer = roomData.dealerId === currentId;
  const dealerName = players.find((p) => p.id === roomData.dealerId)?.username;

  const handleShuffle = () => socket.emit('shuffle_deck', { roomCode });
  const handleDeal = () => {
    const count = Math.max(1, Math.min(52, Number(dealCount) || 1));
    socket.emit('deal_cards', { roomCode, count });
  };
  const handleReset = () => socket.emit('reset_game', { roomCode });

  const handlePlayCardAt = (cardId, x, y) => {
    socket.emit('play_card', { roomCode, cardId, x, y });
  };

  const handlePlayCardRandom = (cardId) => {
    // Place played cards at a slight random offset so they don't stack identically
    const randomX = Math.floor(Math.random() * 200) - 100;
    const randomY = Math.floor(Math.random() * 100) - 50;
    socket.emit('play_card', { roomCode, cardId, x: randomX, y: randomY });
  };

  const handleMoveCard = (cardId, x, y, isFinal = false) => {
    socket.emit('move_card', { roomCode, cardId, x, y, isFinal });
  };

  const handleFlipCard = (cardId) => {
    socket.emit('flip_card', { roomCode, cardId });
  };

  const handlePickupCard = (cardId) => {
    socket.emit('pickup_card', { roomCode, cardId });
  };

  const handleDrawCard = () => socket.emit('draw_card', { roomCode });

  const handleAssignDealer = (targetPlayerId) => {
    socket.emit('assign_dealer', { roomCode, hostKey, targetPlayerId });
  };

  const handleScoreChange = (targetPlayerId, delta) => {
    socket.emit('update_score', { roomCode, targetPlayerId, delta });
  };

  const handleSaveSession = () => {
    socket.emit('save_session', { roomCode, hostKey });
  };
  
  const handleKickPlayer = (targetPlayerId) => {
    socket.emit('kick_player', { roomCode, hostKey, targetPlayerId });
    setConfirmKickId(null);
  };

  return (
    <div className="room-session max-w-6xl mx-auto p-5 pb-56 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold">Room Code: {roomCode}</h2>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/room/${roomCode}`);
              alert(`Copied room link: ${window.location.origin}/room/${roomCode}`);
            }}
            className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300"
          >
            Copy Link
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 flex items-center gap-1.5">
            Card Back:
            <select
              value={cardBack}
              onChange={handleCardBackChange}
              className="px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-800 text-sm"
            >
              <option value="B1">Gray</option>
              <option value="B2">Pink</option>
              <option value="classic-blue">Blue</option>
              <option value="classic-red">Red</option>
            </select>
          </label>
          <button
            onClick={() => setIsScoreboardOpen(true)}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Scoreboard
          </button>
          {localStorage.getItem(`hostKey_${roomCode}`) && (
            <button
              onClick={handleSaveSession}
              className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800"
            >
              Save Session
            </button>
          )}
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* Players & Controls Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-xl bg-slate-100 border border-slate-200">
        <div>
          <h3 className="font-semibold mb-1">Players Connected ({players.length}):</h3>
          <ul className="space-y-1.5 text-sm">
            {players.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5">
                <strong>{p.username}</strong>
                {p.id === currentId && <span className="text-slate-500">(You)</span>}
                {roomData.hostId === p.id && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-800 font-medium">
                    Host
                  </span>
                )}
                {roomData.dealerId === p.id && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-800 font-medium">
                    Dealer
                  </span>
                )}
                <span>
                  — Hand: {gameState?.handCounts?.[p.id] ?? gameState?.hands?.[p.id]?.length ?? 0} | Score:{' '}
                  {gameState?.scores?.[p.id] ?? 0}
                  {isDealer && (
                    <>
                      {' '}(
                      <button onClick={() => handleScoreChange(p.id, 1)} className="underline hover:text-emerald-700">+1</button> /{' '}
                      <button onClick={() => handleScoreChange(p.id, -1)} className="underline hover:text-red-700">-1</button>
                      )
                    </>
                  )}
                </span>

                {isHost && roomData.dealerId !== p.id && (
                  <button
                    onClick={() => handleAssignDealer(p.id)}
                    className="ml-1 px-2 py-0.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Make Dealer
                  </button>
                )}

                {isHost && p.id !== currentId && (
                  confirmKickId === p.id ? (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <button
                        onClick={() => handleKickPlayer(p.id)}
                        className="px-2 py-0.5 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700"
                      >
                        Confirm Kick
                      </button>
                      <button
                        onClick={() => setConfirmKickId(null)}
                        className="px-1.5 py-0.5 text-xs rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmKickId(p.id)}
                      className="ml-1 px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                    >
                      Kick
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDealer ? (
            <>
              <button onClick={handleShuffle} className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm hover:bg-slate-700">
                Shuffle Deck
              </button>

              <div className="flex items-center rounded bg-amber-600 text-white text-sm overflow-hidden">
                <button
                  onClick={handleDeal}
                  className="px-3 py-1.5 font-medium hover:bg-amber-700"
                >
                  Deal
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, deckCount)}
                  value={dealCount}
                  onChange={(e) => setDealCount(e.target.value)}
                  aria-label="Number of cards to deal"
                  className="w-12 py-1 px-1.5 text-center text-slate-900 bg-amber-50 border-x border-amber-700 focus:outline-none"
                />
                <button
                  onClick={handleDeal}
                  className="px-3 py-1.5 font-medium hover:bg-amber-700"
                >
                  Cards
                </button>
              </div>

              <button onClick={handleDrawCard} className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm hover:bg-slate-700">
                Draw 1 Card
              </button>

              <button onClick={handleReset} className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700">
                Reset Table
              </button>
            </>
          ) : (
            <>
              <span className="px-3 py-1.5 rounded bg-slate-200 text-slate-600 text-xs">
                {dealerName ? `Dealer: ${dealerName}` : 'No Dealer Assigned'}
              </span>

              <button onClick={handleDrawCard} className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm hover:bg-slate-700">
                Draw 1 Card
              </button>
            </>
          )}
        </div>
      </div>

      {/* Shared Central Table + Real-Time Action Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-9">
          <Table
            tableCards={tableCards}
            deckCount={deckCount}
            actionLog={gameState?.actionLog || []}
            backStyle={cardBack}
            tableRef={tableRef}
            handRef={handRef}
            onHandHoverChange={setIsHandDropTarget}
            onMoveCard={handleMoveCard}
            onFlipCard={handleFlipCard}
            onPickupCard={handlePickupCard}
            onDrawCard={handleDrawCard}
          />
        </div>
        <div className="lg:col-span-3">
          <ActionLog actionLog={gameState?.actionLog || []} />
        </div>
      </div>

      {/* Interactive Scoreboard Modal */}
      <Scoreboard
        isOpen={isScoreboardOpen}
        onClose={() => setIsScoreboardOpen(false)}
        players={players}
        scores={gameState?.scores || {}}
        dealerId={roomData.dealerId}
        currentSocketId={currentId}
        isDealer={isDealer}
        onScoreChange={handleScoreChange}
      />

      {/* Fixed Bottom Private Hand Overlay */}
      <Hand
        hand={myHand}
        backStyle={cardBack}
        tableRef={tableRef}
        handRef={handRef}
        isDropTarget={isHandDropTarget}
        onPlayCardAt={handlePlayCardAt}
        onPlayCardRandom={handlePlayCardRandom}
      />
    </div>
  );
}