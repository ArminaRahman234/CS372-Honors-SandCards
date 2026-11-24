import React, { useEffect, useRef } from 'react';

export default function ActionLog({ actionLog = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog]);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 shadow-lg flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
          Live Action Feed
        </h3>
        <span className="text-xs text-slate-400">{actionLog.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {actionLog.length === 0 ? (
          <p className="text-slate-400 italic">No table activity yet.</p>
        ) : (
          actionLog.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/70 leading-relaxed"
            >
              <span className="text-[10px] font-mono text-emerald-400 block mb-0.5">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-slate-100">{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}