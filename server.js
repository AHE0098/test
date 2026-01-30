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
  phase: "lobby", // lobby | question | reveal | fin
