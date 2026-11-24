import React, { useRef, useState, useEffect } from 'react';
import Card, { CardBack } from './Card';

export default function Table({
  tableCards = [],
  deckCount = 0,
  actionLog = [],
  backStyle = 'B1',
  tableRef: externalTableRef,
  handRef,
  onHandHoverChange,
  onMoveCard,
  onFlipCard,
  onPickupCard,
  onDrawCard,
}) {
  const internalTableRef = useRef(null);
  const tableRef = externalTableRef || internalTableRef;
  const dragStateRef = useRef(null);
  const clickTimerRef = useRef(null);
  const rafRef = useRef(null);
  const lastHandledLogIdRef = useRef(actionLog[actionLog.length - 1]?.id || null);

  // Local optimistic position while dragging so movement feels instant at 60fps
  const [draggingCard, setDraggingCard] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);

  useEffect(() => {
    const latestEntry = actionLog[actionLog.length - 1];
    if (!latestEntry || latestEntry.id === lastHandledLogIdRef.current) return;

    lastHandledLogIdRef.current = latestEntry.id;

    if (latestEntry.message?.includes('shuffled the deck')) {
      setIsShuffling(true);
      const timer = setTimeout(() => setIsShuffling(false), 600);
      return () => clearTimeout(timer);
    }
  }, [actionLog]);

  const handlePointerDown = (e, card) => {
    // Only respond to primary mouse button / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragStateRef.current = {
      cardId: card.id,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      origX: card.x || 0,
      origY: card.y || 0,
      hasDragged: false,
    };
  };

  const handlePointerMove = (e) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startPointerX;
    const dy = e.clientY - drag.startPointerY;

    if (!drag.hasDragged && Math.hypot(dx, dy) > 5) {
      drag.hasDragged = true;
    }

    if (drag.hasDragged) {
      let nextX = Math.round(drag.origX + dx);
      let nextY = Math.round(drag.origY + dy);

      const handRect = handRef?.current?.getBoundingClientRect();
      const isOverHand =
        handRect &&
        e.clientX >= handRect.left &&
        e.clientX <= handRect.right &&
        e.clientY >= handRect.top &&
        e.clientY <= handRect.bottom;

      onHandHoverChange?.(Boolean(isOverHand));

      if (!isOverHand && tableRef.current) {
        // Card is w-20 (80px wide, ~112px tall); keep full card inside inner felt
        const maxX = Math.max(0, Math.floor(tableRef.current.clientWidth / 2 - 44));
        const maxY = Math.max(0, Math.floor(tableRef.current.clientHeight / 2 - 60));
        nextX = Math.max(-maxX, Math.min(maxX, nextX));
        nextY = Math.max(-maxY, Math.min(maxY, nextY));
      }

      setDraggingCard({ id: drag.cardId, x: nextX, y: nextY });

      // Throttle Socket.io move_card emissions to animation frames (skip if hovering hand dropzone)
      if (!isOverHand && !rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          onMoveCard(drag.cardId, nextX, nextY, false);
          rafRef.current = null;
        });
      }
    }
  };

  const handlePointerUp = (e, card) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const wasDragged = drag.hasDragged;
    dragStateRef.current = null;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (wasDragged) {
      onHandHoverChange?.(false);

      const handRect = handRef?.current?.getBoundingClientRect();
      const droppedOnHand =
        handRect &&
        e.clientX >= handRect.left &&
        e.clientX <= handRect.right &&
        e.clientY >= handRect.top &&
        e.clientY <= handRect.bottom;

      if (droppedOnHand) {
        onPickupCard(card.id);
        setDraggingCard(null);
        return;
      }

      let finalX = Math.round(drag.origX + (e.clientX - drag.startPointerX));
      let finalY = Math.round(drag.origY + (e.clientY - drag.startPointerY));

      if (tableRef.current) {
        const maxX = Math.max(0, Math.floor(tableRef.current.clientWidth / 2 - 44));
        const maxY = Math.max(0, Math.floor(tableRef.current.clientHeight / 2 - 60));
        finalX = Math.max(-maxX, Math.min(maxX, finalX));
        finalY = Math.max(-maxY, Math.min(maxY, finalY));
      }

      onMoveCard(card.id, finalX, finalY, true);
      setDraggingCard(null);
      return;
    }

    setDraggingCard(null);

    // Distinguish single-click (flip) from double-click (pick up)
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onPickupCard(card.id);
    } else {
      clickTimerRef.current = setTimeout(() => {
        onFlipCard(card.id);
        clickTimerRef.current = null;
      }, 220);
    }
  };

  return (
    <div
      ref={tableRef}
      className={`relative w-full h-[500px] rounded-3xl bg-emerald-800 border-8 border-amber-900 shadow-inner select-none ${
        draggingCard ? 'overflow-visible z-40' : 'overflow-hidden'
      }`}
    >
      {/* Subtle table instructions */}
      <div className="absolute top-3 left-4 text-xs text-emerald-100/80 pointer-events-none">
        Click deck to draw • Drag cards to move • Click card to flip • Double-click card to pick up
      </div>

      {/* Center Deck Pile */}
      <div
        onClick={deckCount > 0 ? onDrawCard : undefined}
        title={deckCount > 0 ? 'Click to draw 1 card' : 'Deck is empty'}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
          deckCount > 0 ? 'cursor-pointer hover:scale-105 transition-transform' : 'opacity-40 cursor-not-allowed'
        }`}
        style={{ zIndex: 0 }}
      >
        <div className="relative w-20">
          {deckCount > 0 ? (
            <>
              {deckCount > 1 && (
                <div
                  className={`absolute top-1 left-1 w-20 rounded-lg shadow transition-transform duration-300 ease-in-out ${
                    isShuffling ? 'translate-x-5 rotate-6' : 'translate-x-0 rotate-0'
                  }`}
                >
                  <CardBack backStyle={backStyle} />
                </div>
              )}
              <div
                className={`relative w-20 rounded-lg shadow-lg transition-transform duration-300 ease-in-out ${
                  isShuffling ? '-translate-x-5 -rotate-6 scale-105' : 'translate-x-0 rotate-0 scale-100'
                }`}
              >
                <CardBack backStyle={backStyle} />
              </div>
            </>
          ) : (
            <div className="w-20 h-28 rounded-lg border-2 border-dashed border-emerald-300/50 flex items-center justify-center text-xs text-emerald-200">
              Empty
            </div>
          )}
        </div>
        <span className="mt-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-100 text-xs font-medium">
          Deck: {deckCount}
        </span>
      </div>

      {/* Shared Table Cards */}
      {tableCards.map((card) => {
        const isBeingDragged = draggingCard?.id === card.id;
        const posX = isBeingDragged ? draggingCard.x : card.x || 0;
        const posY = isBeingDragged ? draggingCard.y : card.y || 0;

        return (
          <div
            key={card.id}
            onPointerDown={(e) => handlePointerDown(e, card)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, card)}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px))`,
              zIndex: isBeingDragged ? 9999 : card.zIndex || 1,
              touchAction: 'none',
            }}
          >
            <Card
              card={card}
              backStyle={backStyle}
              className={isBeingDragged ? 'scale-105 shadow-2xl cursor-grabbing' : 'hover:scale-105 cursor-grab'}
            />
          </div>
        );
      })}
    </div>
  );
}