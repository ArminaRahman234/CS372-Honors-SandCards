import React, { useState } from 'react';

export default function Scoreboard({
  isOpen,
  onClose,
  players = [],
  scores = {},
  dealerId,
  currentSocketId,
  isDealer,
  onScoreChange,
}) {
  const [customDeltas, setCustomDeltas] = useState({});

  if (!isOpen) return null;

  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  const handleCustomSubmit = (e, playerId) => {
    e.preventDefault();
    const raw = Number(customDeltas[playerId]);
    if (!Number.isFinite(raw) || raw === 0) return;
    onScoreChange(playerId, Math.trunc(raw));
    setCustomDeltas((prev) => ({ ...prev, [playerId]: '' }));
  };

  const handleResetAllScores = () => {
    players.forEach((p) => {
      const current = scores[p.id] ?? 0;
      if (current !== 0) {
        onScoreChange(p.id, -current);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div>
            <h3 className="text-lg font-bold">Manual Scoreboard</h3>
            <p className="text-xs text-slate-300">
              {isDealer
                ? 'Dealer controls active — adjust points for any player'
                : 'Live standings (only the Dealer can modify scores)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
          >
            Close
          </button>
        </div>

        {/* Standings List */}
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {sortedPlayers.map((p, index) => {
            const score = scores[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="flex flex-col gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                {/* Top Row: Rank, Name & Badges */}
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                    #{index + 1}
                  </span>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{p.username}</span>
                    {p.id === currentSocketId && (
                      <span className="text-xs font-normal text-slate-500">(You)</span>
                    )}
                    {p.id === dealerId && (
                      <span className="px-1.5 py-0.5 text-[11px] rounded bg-amber-100 text-amber-800 font-medium">
                        Dealer
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Current Score & Dealer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
                  <span className="text-lg font-bold tabular-nums text-slate-900">
                    {score} pts
                  </span>

                  {isDealer && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onScoreChange(p.id, -5)}
                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => onScoreChange(p.id, -1)}
                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => onScoreChange(p.id, 1)}
                        className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => onScoreChange(p.id, 5)}
                        className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium"
                      >
                        +5
                      </button>
                      <form
                        onSubmit={(e) => handleCustomSubmit(e, p.id)}
                        className="flex items-center ml-1"
                      >
                        <input
                          type="number"
                          placeholder="±"
                          value={customDeltas[p.id] ?? ''}
                          onChange={(e) =>
                            setCustomDeltas((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                          className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded-l bg-white text-slate-900 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 text-xs rounded-r bg-slate-800 text-white hover:bg-slate-700"
                        >
                          Add
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {isDealer && players.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleResetAllScores}
              className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 font-medium"
            >
              Reset All Scores to 0
            </button>
          </div>
        )}
      </div>
    </div>
  );
}