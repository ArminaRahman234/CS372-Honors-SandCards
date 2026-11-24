import React from 'react';
import * as Deck from '@letele/playing-cards';

export function CardBack({ backStyle = 'B1' }) {
  if (backStyle === 'classic-blue' || backStyle === 'classic-red') {
    const bgClass =
      backStyle === 'classic-red'
        ? 'bg-red-800 border-red-300/60'
        : 'bg-blue-800 border-blue-300/60';

    return (
      <div
        className={`w-20 h-28 rounded-lg border-2 border-white ${
          backStyle === 'classic-red' ? 'bg-red-900' : 'bg-blue-900'
        } p-1.5 flex items-center justify-center`}
      >
        <div className={`w-full h-full rounded border ${bgClass}`} />
      </div>
    );
  }

  const BackSvg = Deck[backStyle] || Deck.B1;
  return <BackSvg style={{ width: '100%', height: 'auto', display: 'block' }} />;
}

// Converts backend card properties to package keys (e.g., suit='spades', value='A' -> "Sa"; value='10' -> "S10")
function getCardComponent(card) {
  const suit = card.suit[0].toUpperCase(); // 'spades' -> 'S'
  const rank = card.value.toLowerCase();   // 'A' -> 'a', '10' -> '10', 'K' -> 'k'
  const key = `${suit}${rank}`;

  return Deck[key] || Deck.B1;
}

export default function Card({
  card,
  faceUp,
  backStyle = 'B1',
  onClick,
  onDoubleClick,
  onPointerDown,
  className = '',
}) {
  const isFaceUp = faceUp !== undefined ? faceUp : card.faceUp;
  const CardSvg = isFaceUp ? getCardComponent(card) : null;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      className={`w-20 select-none cursor-pointer rounded-lg shadow-md transition-transform ${className}`}
    >
      {isFaceUp ? (
        <CardSvg style={{ width: '100%', height: 'auto', display: 'block' }} />
      ) : (
        <CardBack backStyle={backStyle} />
      )}
    </div>
  );
}