import React, { useRef, useState } from 'react';
import Card from './Card';

export default function Hand({
  hand = [],
  backStyle = 'B1',
  tableRef,
  handRef,
  isDropTarget = false,
  onPlayCardAt,
  onPlayCardRandom,
}) {
  const dragRef = useRef(null);
  const [draggingCard, setDraggingCard] = useState(null);

  const handlePointerDown = (e, card) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = {
      card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      hasDragged: false,
    };
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.hasDragged && Math.hypot(dx, dy) > 6) {
      drag.hasDragged = true;
    }

    if (drag.hasDragged) {
      setDraggingCard({
        card: drag.card,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const wasDragged = drag.hasDragged;
    const card = drag.card;
    dragRef.current = null;
    setDraggingCard(null);

    if (!wasDragged) {
      onPlayCardRandom(card.id);
      return;
    }

    // Check if dropped inside the shared Table bounds
    if (tableRef?.current) {
      const rect = tableRef.current.getBoundingClientRect();
      const insideTable =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (insideTable) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxX = Math.max(0, Math.floor(rect.width / 2 - 44));
        const maxY = Math.max(0, Math.floor(rect.height / 2 - 60));

        const dropX = Math.max(-maxX, Math.min(maxX, Math.round(e.clientX - centerX)));
        const dropY = Math.max(-maxY, Math.min(maxY, Math.round(e.clientY - centerY)));

        onPlayCardAt(card.id, dropX, dropY);
      }
    }
  };

  return (
    <>
      {/* Fixed Bottom Private Hand Overlay */}
      <div
        ref={handRef}
        className={`fixed bottom-0 inset-x-0 z-50 transition-colors border-t-2 shadow-2xl px-6 py-3 ${
          isDropTarget
            ? 'bg-emerald-900/95 border-emerald-400'
            : 'bg-slate-900/95 border-slate-700'
        } backdrop-blur-sm`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Your Private Hand ({hand.length})
              <span className="ml-2 text-xs font-normal text-slate-400">
                Drag a card onto the table (or click) to play • Drag table cards here to pick up
              </span>
            </h3>
            {isDropTarget && (
              <span className="text-xs font-semibold text-emerald-300 animate-pulse">
                Release to pick up into hand
              </span>
            )}
          </div>

          {hand.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              Your hand is empty. Click the center deck or wait for the dealer to deal.
            </p>
          ) : (
            <div className="flex justify-center items-end overflow-visible pb-6 pt-5 px-6">
              {hand.map((card, index) => {
                const isDraggingThis = draggingCard?.card.id === card.id;
                const total = hand.length;
                const half = (total - 1) / 2;
                // Normalized position from -1 (leftmost) to +1 (rightmost)
                const t = half > 0 ? (index - half) / half : 0;

                // Total angular spread grows gently with hand size, capped at 56deg (-28 to +28)
                const maxAngle = Math.min(28, half * 4);
                const rotateDeg = t * maxAngle;

                // Smooth parabolic arc (t^2) so outer cards curve down naturally
                const maxArcY = Math.min(28, half * 3);
                const arcY = t * t * maxArcY;

                // Tighten overlap dynamically when holding lots of cards
                const overlapPx = total <= 7 ? 20 : Math.min(54, Math.round(20 + (total - 7) * 1.6));

                return (
                  <div
                    key={card.id}
                    onPointerDown={(e) => handlePointerDown(e, card)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{
                      touchAction: 'none',
                      marginLeft: index > 0 ? `-${overlapPx}px` : 0,
                      transform: `translateY(${arcY}px) rotate(${rotateDeg}deg)`,
                      transformOrigin: 'bottom center',
                      zIndex: index + 1,
                    }}
                    className={`transition-transform hover:z-40 ${
                      isDraggingThis ? 'opacity-30' : ''
                    }`}
                  >
                    <Card
                      card={card}
                      faceUp={true}
                      backStyle={backStyle}
                      className="hover:-translate-y-3 hover:scale-105 cursor-grab"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Card Preview Following Cursor While Dragging From Hand */}
      {draggingCard && (
        <div
          style={{
            position: 'fixed',
            left: draggingCard.clientX,
            top: draggingCard.clientY,
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <Card
            card={draggingCard.card}
            faceUp={true}
            backStyle={backStyle}
            className="scale-110 shadow-2xl"
          />
        </div>
      )}
    </>
  );
}