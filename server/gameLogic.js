const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Helper to create a standard 52-card deck
export function createDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      // Create a short unique ID like "AS" (Ace of Spades) or "10H" (10 of Hearts)
      const suitLetter = suit[0].toUpperCase();
      deck.push({
        id: `${value}${suitLetter}`,
        suit,
        value,
        faceUp: false,
        x: 0,
        y: 0,
        zIndex: 1,
      });
    }
  }

  return deck;
}

// Fisher-Yates shuffle (randomizes a deck in place and returns it)
export function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createInitialGameState() {
  return {
    deck: shuffleDeck(createDeck()),
    tableCards: [],
    hands: {},
    scores: {},
    actionLog: [],
  };
}

// Deal `count` cards from the top of the deck to each connected player's hand
export function dealCards(gameState, playerIds, count = 5) {
  for (let i = 0; i < count; i++) {
    for (const playerId of playerIds) {
      if (gameState.deck.length === 0) return; // Stop if deck runs out
      const card = gameState.deck.pop();
      if (!gameState.hands[playerId]) {
        gameState.hands[playerId] = [];
      }
      gameState.hands[playerId].push(card);
    }
  }
}

// Play a card from a player's hand onto the center oval table
export function playCardToTable(gameState, playerId, cardId, x = 0, y = 0) {
  const hand = gameState.hands[playerId];
  if (!hand) return;

  const index = hand.findIndex((c) => c.id === cardId);
  if (index === -1) return;

  const [card] = hand.splice(index, 1);
  card.x = x;
  card.y = y;
  card.faceUp = false; // Cards played to the table start face-down until flipped/revealed
  card.zIndex = gameState.tableCards.length + 1;
  gameState.tableCards.push(card);
}

// Update X/Y coordinates of a card already on the table and bring it to the front
export function moveTableCard(gameState, cardId, x, y) {
  const card = gameState.tableCards.find((c) => c.id === cardId);
  if (!card) return;

  card.x = x;
  card.y = y;
  const maxZ = gameState.tableCards.reduce((max, c) => Math.max(max, c.zIndex), 1);
  card.zIndex = maxZ + 1;
}

// Toggle faceUp on a table card
export function flipTableCard(gameState, cardId) {
  const card = gameState.tableCards.find((c) => c.id === cardId);
  if (!card) return;

  card.faceUp = !card.faceUp;
}

// Draw 1 card from the top of the deck into a specific player's hand
export function drawCardFromDeck(gameState, playerId) {
  if (gameState.deck.length === 0) return;

  const card = gameState.deck.pop();
  if (!gameState.hands[playerId]) {
    gameState.hands[playerId] = [];
  }
  gameState.hands[playerId].push(card);
}

// Pick up a card from the center table and return it to a player's private hand
export function pickupCardFromTable(gameState, playerId, cardId) {
  const index = gameState.tableCards.findIndex((c) => c.id === cardId);
  if (index === -1) return;

  const [card] = gameState.tableCards.splice(index, 1);
  card.faceUp = false;
  card.x = 0;
  card.y = 0;

  if (!gameState.hands[playerId]) {
    gameState.hands[playerId] = [];
  }
  gameState.hands[playerId].push(card);
}