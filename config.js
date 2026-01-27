// config.js
// =====================
// All tunables live here.
// Change these values to control the game without touching the "engine".
// =====================

const CFG = {
  // --- Version stamp (bump this every time you update questions/settings) ---
  QUIZ_VERSION: "v2026-01-27-b", // Shown in UI so you can verify the deployed build instantly

  // --- Question pack selection ---
  QUESTION_SET_KEY: "party-dk-v1", // Which question pack to play (key in QUESTION_SETS)
  QUESTIONS_PER_GAME: 10,          // How many questions to use from that pack
  SHUFFLE_QUESTIONS: true,         // Shuffle question order at game start
  SHUFFLE_OPTIONS: true,           // Shuffle answer options per question (correctIndex updates)

  // --- Game size ---
  MAX_PLAYERS: 12,               // Max active players (extra become spectators)
  MIN_PLAYERS_TO_START: 2,       // Minimum active players required to start

  // --- Timing ---
  QUESTION_TIME_MS: 12000,       // Time allowed per question (milliseconds)
  QUESTION_START_DELAY_MS: 800,  // Fair start: clients enable buttons at the same time

  // --- Flow ---
  REQUIRE_READY_BETWEEN_QUESTIONS: true, // Everyone must press Ready between questions
  AUTO_START_WHEN_ALL_READY: true,       // In lobby, auto-start when all active players are Ready

  // --- Scoring (kept secret until game over) ---
  BASE_POINTS_CORRECT: 1000,     // Base points for a correct answer
  SPEED_BONUS_FACTOR: 1.0,       // 0 = ignore speed; 1 = linear bonus based on remaining time
  WRONG_POINTS: 0,               // Points for incorrect answer (can be negative)
  NO_ANSWER_POINTS: 0,           // Points if no answer before time runs out

  // --- Logging / debug ---
  LOG_EVENTS: true               // Server console logs (turn off to reduce noise)
};

module.exports = { CFG };
