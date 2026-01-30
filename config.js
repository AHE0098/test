// config.js
// All tunables / knobs live here.

const QUIZ_VERSION = "v-rounds-3-setup-001";

// --- Players ---
const MAX_PLAYERS = 12;          // active players (extras become spectators)
const ALLOW_SPECTATORS = true;

// --- Timing ---
const START_DELAY_MS = 900;      // buffer so phones can sync + enable buttons fairly
const QUESTION_MS = 14000;       // time to answer each question
const REVEAL_MIN_MS = 1200;      // small buffer before allowing "Ready" after reveal (optional)

// --- Flow ---
const REQUIRE_READY_IN_LOBBY = true;
const REQUIRE_READY_AFTER_REVEAL = true;

// --- Scoring ---
const SCORE_CORRECT_BASE = 1000;
const SCORE_WRONG = 0;
const SCORE_NO_ANSWER = 0;

// Speed bonus: points proportional to remaining fraction of time.
// Example: if SPEED_BONUS_MAX=500, answering instantly yields +500, at the buzzer yields ~0.
const SPEED_BONUS_ENABLED = true;
const SPEED_BONUS_MAX = 500;

// --- Question behavior ---
const SHUFFLE_OPTIONS = true;

// --- ROUNDS (the new thing) ---
// Each round selects questions from a different set.
// Edit this array to change number of rounds, sets, and questions per round.
const ROUNDS = [
  { setKey: "party-dk-v1", questions: 4 },
  { setKey: "science-nerd-v1", questions: 4 },
  { setKey: "spicy-meds-v1", questions: 4 }
];

const LOG_EVENTS = true;

module.exports = {
  QUIZ_VERSION,
  MAX_PLAYERS,
  ALLOW_SPECTATORS,
  START_DELAY_MS,
  QUESTION_MS,
  REVEAL_MIN_MS,
  REQUIRE_READY_IN_LOBBY,
  REQUIRE_READY_AFTER_REVEAL,
  SCORE_CORRECT_BASE,
  SCORE_WRONG,
  SCORE_NO_ANSWER,
  SPEED_BONUS_ENABLED,
  SPEED_BONUS_MAX,
  SHUFFLE_OPTIONS,
  ROUNDS,
  LOG_EVENTS
};
