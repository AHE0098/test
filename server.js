// server.js
// =====================
// Real-time mobile quiz server (Express + Socket.io)
// One room / one game session.
// =====================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { CFG } = require("./config");
const { QUESTION_SETS } = require("./questions");

// ---------------------
// Server setup
// ---------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require("path");

// Serve ONLY the frontend files from repo root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/client.js", (req, res) => {
  res.sendFile(path.join(__dirname, "client.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/ui-config.js", (req, res) => {
  res.sendFile(path.join(__dirname, "ui-config.js"));
});


// ---------------------
// State
// ---------------------
// player: { id, name, ready, score, spectator }
const players = new Map(); // socketId -> player

let phase = "lobby"; // "lobby" | "question" | "reveal" | "gameover"
let qIndex = 0;

let round = null;
// round = {
//   questionId,
//   startAt, endAt,
//   requiredPlayerIds: [],
//   answers: Map(socketId -> { answerIndex|null, answerAt|null }),
//   ended: false
// }

let questionTimer = null;

// ---------------------
// Helpers
// ---------------------
function log(...args) {
  if (CFG.LOG_EVENTS) console.log(...args);
}

function activePlayerIds() {
  return [...players.entries()]
    .filter(([_, p]) => !p.spectator)
    .map(([id]) => id);
}

function playerListPublic() {
  return [...players.values()].map(p => ({
    name: p.name,
    ready: !!p.ready,
    spectator: !!p.spectator
  }));
}

function broadcastLobby() {
  io.emit("lobbyUpdate", {
    phase,
    cfgPublic: {
      QUIZ_VERSION: CFG.QUIZ_VERSION,
      MAX_PLAYERS: CFG.MAX_PLAYERS,
      MIN_PLAYERS_TO_START: CFG.MIN_PLAYERS_TO_START,
      QUESTION_TIME_MS: CFG.QUESTION_TIME_MS,
      QUESTION_START_DELAY_MS: CFG.QUESTION_START_DELAY_MS,
      REQUIRE_READY_BETWEEN_QUESTIONS: CFG.REQUIRE_READY_BETWEEN_QUESTIONS
    },
    players: playerListPublic()
  });
}

function broadcastReadyStatus() {
  io.emit("readyUpdate", { phase, players: playerListPublic() });
}

function allActivePlayersReady() {
  const ids = activePlayerIds();
  if (ids.length < CFG.MIN_PLAYERS_TO_START) return false;
  return ids.every(id => players.get(id)?.ready);
}

function markAllNotReady() {
  for (const p of players.values()) p.ready = false;
}

function clearQuestionTimer() {
  if (questionTimer) clearTimeout(questionTimer);
  questionTimer = null;
}

function setPhase(next) {
  phase = next;
  broadcastLobby();
}

function computePoints({ correct, answerAt, startAt, endAt }) {
  if (answerAt == null) return CFG.NO_ANSWER_POINTS;
  if (!correct) return CFG.WRONG_POINTS;

  const total = endAt - startAt;
  const timeTaken = Math.max(0, Math.min(total, answerAt - startAt));
  const remainingRatio = total > 0 ? Math.max(0, (total - timeTaken) / total) : 0;

  const bonus = Math.floor(CFG.BASE_POINTS_CORRECT * CFG.SPEED_BONUS_FACTOR * remainingRatio);
  return CFG.BASE_POINTS_CORRECT + bonus;
}
// ---------------------
// Question selection + validation
// ---------------------
let gameQuestions = [];

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleOptionsKeepCorrect(q) {
  // returns a new question where options are shuffled, and correctIndex updated accordingly
  const indexed = q.options.map((text, idx) => ({ text, idx }));
  shuffleInPlace(indexed);

  const newOptions = indexed.map(x => x.text);
  const newCorrectIndex = indexed.findIndex(x => x.idx === q.correctIndex);

  return { ...q, options: newOptions, correctIndex: newCorrectIndex };
}

function validateQuestionSet(setKey) {
  const set = QUESTION_SETS[setKey];
  if (!set) throw new Error(`Unknown QUESTION_SET_KEY: ${setKey}`);

  const qs = set.questions;
  if (!Array.isArray(qs) || qs.length === 0) throw new Error(`Question set ${setKey} has no questions`);

  const ids = new Set();
  for (const q of qs) {
    if (!q || typeof q !== "object") throw new Error(`Invalid question in set ${setKey}`);
    if (typeof q.id !== "string" || !q.id) throw new Error(`Question missing id in set ${setKey}`);
    if (ids.has(q.id)) throw new Error(`Duplicate question id "${q.id}" in set ${setKey}`);
    ids.add(q.id);

    if (typeof q.text !== "string" || !q.text) throw new Error(`Question ${q.id} missing text`);
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`Question ${q.id} must have >=2 options`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      throw new Error(`Question ${q.id} has invalid correctIndex`);
    }
  }
  return set;
}

function prepareGameQuestions() {
  const set = validateQuestionSet(CFG.QUESTION_SET_KEY);

  let qs = set.questions.map(q => ({ ...q })); // shallow clone
  if (CFG.SHUFFLE_QUESTIONS) qs = shuffleInPlace(qs);

  // limit number of questions
  const n = Math.min(CFG.QUESTIONS_PER_GAME ?? qs.length, qs.length);
  qs = qs.slice(0, n);

  if (CFG.SHUFFLE_OPTIONS) {
    qs = qs.map(shuffleOptionsKeepCorrect);
  }

  gameQuestions = qs;
  log("[QUESTIONS] Using set:", CFG.QUESTION_SET_KEY, "-", set.title, "count:", gameQuestions.length);
}

// ---------------------
// Game flow
// ---------------------
function startGameIfPossible() {
  if (phase !== "lobby") return;
  if (!CFG.AUTO_START_WHEN_ALL_READY) return;
  if (!allActivePlayersReady()) return;

  qIndex = 0;
  for (const p of players.values()) p.score = 0;

try {
  prepareGameQuestions();
} catch (err) {
  console.error("[QUESTIONS] Failed to prepare questions:", err?.message || err);
  // Stay in lobby so you can fix config/questions without bricking the app
  setPhase("lobby");
  return;
}

startQuestionRound();

}

function startQuestionRound() {
if (qIndex >= gameQuestions.length) return endGame();

  clearQuestionTimer();
  markAllNotReady();
  setPhase("question");

  const q = gameQuestions[qIndex];
  const requiredIds = activePlayerIds();

  const now = Date.now();
  const startAt = now + CFG.QUESTION_START_DELAY_MS;
  const endAt = startAt + CFG.QUESTION_TIME_MS;

  round = {
    questionId: q.id,
    startAt,
    endAt,
    requiredPlayerIds: requiredIds,
    answers: new Map(),
    ended: false
  };

  for (const id of requiredIds) {
    round.answers.set(id, { answerIndex: null, answerAt: null });
  }

  io.emit("newQuestion", {
    phase,
    question: { id: q.id, text: q.text, options: q.options },
    meta: { qNumber: qIndex + 1, qTotal: gameQuestions.length, startAt, endAt }
  });

  questionTimer = setTimeout(() => endQuestionRound("time_up"), Math.max(0, endAt - Date.now()));
  log("[ROUND start]", q.id, "players:", requiredIds.length);
}

function maybeEndRoundEarlyIfAllAnswered() {
  if (!round || round.ended) return;
  const allAnswered = round.requiredPlayerIds.every(id => {
    const a = round.answers.get(id);
    return a && a.answerIndex != null;
  });
  if (allAnswered) endQuestionRound("all_answered");
}

function endQuestionRound(reason) {
  if (!round || round.ended) return;
  round.ended = true;
  clearQuestionTimer();

  setPhase("reveal");

  const q = gameQuestions[qIndex];
  const correctIndex = q.correctIndex;

  const revealRows = round.requiredPlayerIds.map(id => {
    const p = players.get(id);
    const a = round.answers.get(id) || { answerIndex: null, answerAt: null };

    const isCorrect = a.answerIndex === correctIndex;
    const points = computePoints({
      correct: isCorrect,
      answerAt: a.answerAt,
      startAt: round.startAt,
      endAt: round.endAt
    });

    if (p) p.score += points;

    return {
      name: p?.name ?? "Unknown",
      answerIndex: a.answerIndex,
      answerText: a.answerIndex == null ? null : q.options[a.answerIndex],
      isCorrect: a.answerIndex == null ? false : isCorrect,
      didAnswer: a.answerIndex != null
    };
  });

  markAllNotReady();

  io.emit("reveal", {
    phase,
    reason,
    correctIndex,
    correctText: q.options[correctIndex],
    answers: revealRows,
    meta: { qNumber: qIndex + 1, qTotal: gameQuestions.length }
  });

  log("[ROUND end]", q.id, reason);
}

function endGame() {
  setPhase("gameover");

  const final = [...players.values()]
    .filter(p => !p.spectator)
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.emit("gameOver", { phase, final });
  log("[GAME over]", final);
}

// ---------------------
// Socket handlers
// ---------------------
io.on("connection", socket => {
  log("[CONNECT]", socket.id);

  players.set(socket.id, {
    id: socket.id,
    name: "Player",
    ready: false,
    score: 0,
    spectator: true
  });

  broadcastLobby();

  socket.on("join", payload => {
    const p = players.get(socket.id);
    if (!p) return;

    const name = (payload?.name ?? "Player").toString().slice(0, 24);
    p.name = name;

    // Promote to active if room
    const activeCount = activePlayerIds().length;
    p.spectator = activeCount >= CFG.MAX_PLAYERS;

    p.ready = false;

    socket.emit("joinAck", { ok: true, spectator: p.spectator, phase });
    broadcastLobby();

    log("[JOIN]", name, p.spectator ? "(spectator)" : "(active)");
  });

  socket.on("setReady", value => {
    const p = players.get(socket.id);
    if (!p || p.spectator) return;

    p.ready = !!value;
    broadcastReadyStatus();

    if (phase === "lobby") startGameIfPossible();

    if (phase === "reveal" && CFG.REQUIRE_READY_BETWEEN_QUESTIONS) {
      if (allActivePlayersReady()) {
        qIndex++;
        startQuestionRound();
      }
    }
  });

  socket.on("answer", answerIndexRaw => {
    const p = players.get(socket.id);
    if (!p || p.spectator) return;
    if (phase !== "question") return;
    if (!round || round.ended) return;
    if (!round.requiredPlayerIds.includes(socket.id)) return;

    const entry = round.answers.get(socket.id);
    if (!entry) return;
    if (entry.answerIndex != null) return; // only first answer counts

    const q = gameQuestions[qIndex];
    let answerIndex = null;

    if (typeof answerIndexRaw === "number" && Number.isInteger(answerIndexRaw)) {
      if (answerIndexRaw >= 0 && answerIndexRaw < q.options.length) {
        answerIndex = answerIndexRaw;
      }
    }

    entry.answerIndex = answerIndex;
    entry.answerAt = Date.now();

    socket.emit("answerAck", { ok: true });
    log("[ANSWER]", p.name, answerIndex);

    maybeEndRoundEarlyIfAllAnswered();
  });

  socket.on("disconnect", () => {
    log("[DISCONNECT]", socket.id);
    players.delete(socket.id);

    // If someone leaves mid-question, remove them from required list
    if (round && !round.ended && phase === "question") {
      round.requiredPlayerIds = round.requiredPlayerIds.filter(id => players.has(id));
      maybeEndRoundEarlyIfAllAnswered();
    }

    broadcastLobby();
  });
});

// ---------------------
// Start
// ---------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Quiz server running on port ${PORT}`);
});
