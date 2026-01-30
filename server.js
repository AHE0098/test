// server.js
// Express + Socket.io game server + routes to serve frontend files from repo root.

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const CFG = require("./config");
const { QUESTION_SETS } = require("./questions");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// --- Serve static frontend files explicitly from repo root ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/client.js", (req, res) => res.sendFile(path.join(__dirname, "client.js")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/ui-config.js", (req, res) => res.sendFile(path.join(__dirname, "ui-config.js")));

// --- Health endpoint for quick verification ---
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: CFG.QUIZ_VERSION,
    rounds: (CFG.ROUNDS || []).map(r => ({ setKey: r.setKey, questions: r.questions })),
    phase: game.phase,
    prepared: {
      roundCount: game.roundQuestions.length,
      roundIndex: game.roundIndex,
      qInRound: game.qInRound
    }
  });
});

// -------------------
// Utility helpers
// -------------------
function log(...args) {
  if (CFG.LOG_EVENTS) console.log(new Date().toISOString(), ...args);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleOptionsKeepCorrect(q) {
  const pairs = q.options.map((opt, idx) => ({ opt, idx }));
  shuffleInPlace(pairs);
  const newOptions = pairs.map(p => p.opt);
  const newCorrectIndex = pairs.findIndex(p => p.idx === q.correctIndex);
  return { ...q, options: newOptions, correctIndex: newCorrectIndex };
}

function prepareRoundQuestions() {
  const rounds = CFG.ROUNDS;
  if (!Array.isArray(rounds) || rounds.length === 0) {
    throw new Error("CFG.ROUNDS missing/empty");
  }

  const built = rounds.map((r, roundIdx) => {
    const set = QUESTION_SETS[r.setKey];
    if (!set) throw new Error(`Round ${roundIdx + 1}: Unknown setKey "${r.setKey}"`);

    let qs = [...set.questions];
    shuffleInPlace(qs);
    qs = qs.slice(0, r.questions);

    if (CFG.SHUFFLE_OPTIONS) {
      qs = qs.map(shuffleOptionsKeepCorrect);
    }

    qs = qs.map((q, i) => ({
      ...q,
      roundNumber: roundIdx + 1,
      roundCount: rounds.length,
      roundTitle: set.title,
      qInRound: i + 1,
      qInRoundTotal: r.questions
    }));

    return {
      setKey: r.setKey,
      title: set.title,
      description: set.description,
      questions: qs
    };
  });

  return built;
}

function safePublicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    isSpectator: !!p.isSpectator,
    ready: !!p.ready,
    score: p.score ?? 0,
    connected: !!p.connected
  };
}

// -------------------
// Game state
// -------------------
let game = {
  phase: "lobby", // lobby | question | reveal | final
  players: new Map(), // socket.id -> player
  hostId: null,

  // rounds state
  roundQuestions: [],
  roundIndex: 0,
  qInRound: 0,

  // current question timing
  questionStartAt: null,
  questionEndAt: null,

  // answers for current question
  answers: new Map(), // socket.id -> { optionIndex, atMs, isCorrect, points }
};

function resetReadyAll() {
  for (const p of game.players.values()) p.ready = false;
}

function activePlayers() {
  // players that participate (not spectators) and connected
  const arr = [];
  for (const p of game.players.values()) {
    if (!p.connected) continue;
    if (p.isSpectator) continue;
    arr.push(p);
  }
  return arr;
}

function allActiveReady() {
  const aps = activePlayers();
  if (aps.length === 0) return false;
  return aps.every(p => p.ready);
}

function broadcastState(extra = {}) {
  const players = Array.from(game.players.values()).map(safePublicPlayer);
  io.emit("state", {
    version: CFG.QUIZ_VERSION,
    phase: game.phase,
    players,
    maxPlayers: CFG.MAX_PLAYERS,
    rounds: (CFG.ROUNDS || []).map(r => ({ setKey: r.setKey, questions: r.questions })),
    roundIndex: game.roundIndex,
    qInRound: game.qInRound,
    ...extra
  });
}

function currentQuestion() {
  const round = game.roundQuestions[game.roundIndex];
  if (!round) return null;
  return round.questions[game.qInRound] || null; // qInRound is 0-based internally
}

function totalQuestionsCount() {
  return game.roundQuestions.reduce((sum, r) => sum + r.questions.length, 0);
}

function currentQuestionGlobalNumber() {
  // 1-based global index across rounds
  let n = 0;
  for (let ri = 0; ri < game.roundQuestions.length; ri++) {
    const r = game.roundQuestions[ri];
    if (ri < game.roundIndex) n += r.questions.length;
    else if (ri === game.roundIndex) n += game.qInRound + 1;
  }
  return n;
}

function startGame() {
  log("Starting game...");
  game.phase = "question";
  resetReadyAll();

  try {
    game.roundQuestions = prepareRoundQuestions();
    game.roundIndex = 0;
    game.qInRound = 0;
  } catch (err) {
    console.error("Failed to prepare rounds:", err);
    io.emit("gameError", { message: "Question packs broken. Returned to lobby.", detail: String(err.message || err) });
    game.phase = "lobby";
    resetReadyAll();
    broadcastState();
    return;
  }

  broadcastState({ preparedCount: totalQuestionsCount() });
  startQuestion();
}

function startQuestion() {
  const q = currentQuestion();
  if (!q) return endGame();

  game.phase = "question";
  game.answers = new Map();

  const startAt = Date.now() + CFG.START_DELAY_MS;
  const endAt = startAt + CFG.QUESTION_MS;
  game.questionStartAt = startAt;
  game.questionEndAt = endAt;

  // send question without correctIndex
  io.emit("question", {
    id: q.id,
    text: q.text,
    options: q.options,
    startAt,
    endAt,

    // round UI bits
    roundNumber: q.roundNumber,
    roundCount: q.roundCount,
    roundTitle: q.roundTitle,
    qInRound: q.qInRound,
    qInRoundTotal: q.qInRoundTotal,

    // global UI bits (optional)
    qGlobal: currentQuestionGlobalNumber(),
    qGlobalTotal: totalQuestionsCount()
  });

  broadcastState();

  // time expiry -> force reveal
  const msUntilEnd = Math.max(0, endAt - Date.now());
  setTimeout(() => {
    if (game.phase === "question" && Date.now() >= game.questionEndAt - 5) {
      revealAndScore();
    }
  }, msUntilEnd + 30);
}

function scoreAnswer({ pickedIndex, answerAt }) {
  const q = currentQuestion();
  if (!q) return { isCorrect: false, points: 0 };

  const isCorrect = pickedIndex === q.correctIndex;

  if (!isCorrect) return { isCorrect: false, points: CFG.SCORE_WRONG };

  let points = CFG.SCORE_CORRECT_BASE;

  if (CFG.SPEED_BONUS_ENABLED && game.questionStartAt && game.questionEndAt) {
    const dur = game.questionEndAt - game.questionStartAt;
    const remaining = Math.max(0, game.questionEndAt - answerAt);
    const frac = dur > 0 ? remaining / dur : 0;
    points += Math.round(CFG.SPEED_BONUS_MAX * frac);
  }

  return { isCorrect: true, points };
}

function revealAndScore() {
  const q = currentQuestion();
  if (!q) return endGame();

  game.phase = "reveal";

  // apply "no answer" score for active players who didn't answer
  for (const p of activePlayers()) {
    if (!game.answers.has(p.id)) {
      game.answers.set(p.id, {
        optionIndex: null,
        atMs: null,
        isCorrect: false,
        points: CFG.SCORE_NO_ANSWER
      });
      p.score += CFG.SCORE_NO_ANSWER;
    }
  }

  // build reveal payload
  const reveal = [];
  for (const p of game.players.values()) {
    const a = game.answers.get(p.id);
    reveal.push({
      playerId: p.id,
      name: p.name,
      isSpectator: !!p.isSpectator,
      optionIndex: a ? a.optionIndex : null,
      isCorrect: a ? !!a.isCorrect : false,
      points: a ? a.points : 0,
      totalScore: p.score || 0
    });
  }

  io.emit("reveal", {
    questionId: q.id,
    correctIndex: q.correctIndex,
    answers: reveal,
    revealMinMs: CFG.REVEAL_MIN_MS, 
    // round UI
    roundNumber: q.roundNumber,
    roundCount: q.roundCount,
    roundTitle: q.roundTitle,
    qInRound: q.qInRound,
    qInRoundTotal: q.qInRoundTotal,
    qGlobal: currentQuestionGlobalNumber(),
    qGlobalTotal: totalQuestionsCount()
  });

  resetReadyAll();
  broadcastState({ revealMinMs: CFG.REVEAL_MIN_MS });
}

function advanceAfterReveal() {
  const round = game.roundQuestions[game.roundIndex];
  if (!round) return endGame();

  game.qInRound += 1;

  if (game.qInRound >= round.questions.length) {
    game.roundIndex += 1;
    game.qInRound = 0;
  }

  if (game.roundIndex >= game.roundQuestions.length) {
    return endGame();
  }

  startQuestion();
}

function endGame() {
  game.phase = "final";

  const scoreboard = Array.from(game.players.values())
    .filter(p => p.connected && !p.isSpectator)
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  io.emit("final", { scoreboard });
  resetReadyAll();
  broadcastState();
}

function maybeAssignSpectator(socketId) {
  const activeCount = Array.from(game.players.values()).filter(p => p.connected && !p.isSpectator).length;
  if (activeCount >= CFG.MAX_PLAYERS) {
    return CFG.ALLOW_SPECTATORS;
  }
  return false;
}

// -------------------
// Socket handlers
// -------------------
io.on("connection", (socket) => {
  log("connect", socket.id);

  // Create player
  const player = {
    id: socket.id,
    name: null,
    connected: true,
    isSpectator: false,
    ready: false,
    score: 0
  };

  if (!game.hostId) game.hostId = socket.id;

  game.players.set(socket.id, player);
  broadcastState();

  socket.on("join", ({ name }) => {
    const p = game.players.get(socket.id);
    if (!p) return;

    const clean = String(name || "").trim().slice(0, 18);
    p.name = clean || "Player";

    // assign spectator if lobby is full
    p.isSpectator = maybeAssignSpectator(socket.id);

    log("join", socket.id, p.name, p.isSpectator ? "(spectator)" : "");
    broadcastState();
  });

  socket.on("setReady", ({ ready }) => {
    const p = game.players.get(socket.id);
    if (!p) return;
    p.ready = !!ready;

    // Lobby ready -> start game (only if in lobby and require ready)
    if (game.phase === "lobby" && CFG.REQUIRE_READY_IN_LOBBY) {
      if (allActiveReady()) startGame();
      else broadcastState();
      return;
    }

    // Reveal ready -> advance
    if (game.phase === "reveal" && CFG.REQUIRE_READY_AFTER_REVEAL) {
      if (allActiveReady()) {
        advanceAfterReveal();
      } else {
        broadcastState();
      }
      return;
    }

    broadcastState();
  });

  socket.on("answer", ({ optionIndex, clientMs }) => {
    const p = game.players.get(socket.id);
    if (!p) return;
    if (p.isSpectator) return;
    if (game.phase !== "question") return;

    // avoid multiple answers
    if (game.answers.has(socket.id)) return;

    const now = Date.now();
    const startAt = game.questionStartAt;
    const endAt = game.questionEndAt;

    // only accept within window
    if (!startAt || !endAt) return;
    if (now < startAt - 250) return; // too early
    if (now > endAt + 250) return;   // too late

    const pickedIndex = Number(optionIndex);
    if (!Number.isFinite(pickedIndex)) return;

    const { isCorrect, points } = scoreAnswer({ pickedIndex, answerAt: now });

    game.answers.set(socket.id, {
      optionIndex: pickedIndex,
      atMs: now,
      isCorrect,
      points
    });

    p.score += points;

    // if everyone answered, reveal early
    const aps = activePlayers();
    const answeredCount = aps.filter(pp => game.answers.has(pp.id)).length;
    if (answeredCount >= aps.length && aps.length > 0) {
      revealAndScore();
    } else {
      broadcastState({ answeredCount, activeCount: aps.length });
    }
  });

  socket.on("restartLobby", () => {
    // simple admin: only host can reset
    if (socket.id !== game.hostId) return;

    log("restartLobby");
    game.phase = "lobby";
    game.roundQuestions = [];
    game.roundIndex = 0;
    game.qInRound = 0;
    game.questionStartAt = null;
    game.questionEndAt = null;
    game.answers = new Map();

    for (const p of game.players.values()) {
      p.ready = false;
      p.score = 0;
      // re-evaluate spectator status
      p.isSpectator = false;
    }

    // re-apply spectator assignment based on join order
    // (keep it simple: first MAX_PLAYERS remain active)
    const ordered = Array.from(game.players.values()).filter(p => p.connected);
    let count = 0;
    for (const p of ordered) {
      if (count < CFG.MAX_PLAYERS) {
        p.isSpectator = false;
        count++;
      } else {
        p.isSpectator = CFG.ALLOW_SPECTATORS;
      }
    }

    broadcastState();
  });

  socket.on("disconnect", () => {
    log("disconnect", socket.id);
    const p = game.players.get(socket.id);
    if (p) p.connected = false;

    if (socket.id === game.hostId) {
      // pick a new host from connected users
      const next = Array.from(game.players.values()).find(pp => pp.connected);
      game.hostId = next ? next.id : null;
    }

    // if in question phase and a player drops, we might be able to reveal early
    if (game.phase === "question") {
      const aps = activePlayers();
      const answeredCount = aps.filter(pp => game.answers.has(pp.id)).length;
      if (aps.length > 0 && answeredCount >= aps.length) {
        revealAndScore();
      }
    }

    broadcastState();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on :${PORT} (${CFG.QUIZ_VERSION})`);
});
