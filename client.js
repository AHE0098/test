// client.js
// =====================
// Client: UI + Socket events (matches index.html IDs + current server.js events)
// =====================

const UI = window.UI_CFG || { TIMER_TICK_MS: 50 };

// ---- DOM ----
const el = {
  // topbar
  versionTag: document.getElementById("versionTag"),
  phaseTag: document.getElementById("phaseTag"),

  // views
  viewLobby: document.getElementById("viewLobby"),
  viewQuestion: document.getElementById("viewQuestion"),
  viewReveal: document.getElementById("viewReveal"),
  viewFinal: document.getElementById("viewFinal"),

  // lobby
  nameInput: document.getElementById("nameInput"),
  joinBtn: document.getElementById("joinBtn"),
  playerCount: document.getElementById("playerCount"),
  youTag: document.getElementById("youTag"),
  playersList: document.getElementById("playersList"),
  readyBtn: document.getElementById("readyBtn"),
  restartBtn: document.getElementById("restartBtn"),
  lobbyInfo: document.getElementById("lobbyInfo"),

  // question
  roundLabel: document.getElementById("roundLabel"),
  questionText: document.getElementById("questionText"),
  timerInner: document.getElementById("timerInner"),
  options: document.getElementById("options"),
  questionHint: document.getElementById("questionHint"),

  // reveal
  revealRoundLabel: document.getElementById("revealRoundLabel"),
  correctAnswer: document.getElementById("correctAnswer"),
  revealList: document.getElementById("revealList"),
  readyAfterRevealBtn: document.getElementById("readyAfterRevealBtn"),
  revealHint: document.getElementById("revealHint"),

  // final
  finalList: document.getElementById("finalList"),
  finalRestartBtn: document.getElementById("finalRestartBtn")
};

// ---- FX ----
const audio = {
  ready: new Audio((UI && UI.SOUND_READY_URL) || ""),
  playReady() {
    if (!UI.SOUND_ENABLED) return;
    try {
      this.ready.currentTime = 0;
      this.ready.play();
    } catch (_) {}
  }
};

function vibrate(ms) {
  if (!UI.VIBRATE_ENABLED) return;
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ---- State ----
const state = {
  joined: false,
  phase: "lobby",
  me: { name: "", isSpectator: false, ready: false },

  // current Q
  answered: false,
  question: null,
  meta: null,

  // timer
  timerInterval: null
};

// ---- Socket ----
const socket = io();

// ---- UI helpers ----
function setPhase(text) {
  el.phaseTag.textContent = text || "—";
}

function setVersion(v) {
  el.versionTag.textContent = v ? `v${v}` : "v?";
}

function showView(which) {
  el.viewLobby.classList.add("hidden");
  el.viewQuestion.classList.add("hidden");
  el.viewReveal.classList.add("hidden");
  el.viewFinal.classList.add("hidden");
  which.classList.remove("hidden");
}

function clearChildren(node) {
  node.innerHTML = "";
}

function setRoundLabel(node, meta) {
  if (!node) return;
  if (!meta || !meta.roundNumber || !meta.roundCount) {
    node.textContent = "";
    node.style.display = "none";
    return;
  }
  const title = meta.roundTitle ? ` — ${meta.roundTitle}` : "";
  const qPart =
    meta.qInRound && meta.qInRoundTotal ? ` • Q ${meta.qInRound}/${meta.qInRoundTotal}` : "";
  node.textContent = `Round ${meta.roundNumber}/${meta.roundCount}${title}${qPart}`;
  node.style.display = "block";
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function startTimerBar(startAt, endAt) {
  stopTimer();

  function tick() {
    const now = Date.now();
    const total = endAt - startAt;
    const remaining = Math.max(0, endAt - now);
    const ratio = total > 0 ? remaining / total : 0;

    if (el.timerInner) {
      el.timerInner.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    if (now >= endAt) {
      stopTimer();
      disableOptions();
      if (!state.answered) el.questionHint.textContent = "⏳ Tiden er gået.";
    }
  }

  tick();
  state.timerInterval = setInterval(tick, UI.TIMER_TICK_MS || 50);
}

function disableOptions() {
  [...el.options.querySelectorAll("button")].forEach(b => (b.disabled = true));
}

function enableOptions() {
  [...el.options.querySelectorAll("button")].forEach(b => (b.disabled = false));
}

function renderPlayers(players) {
  // count + list
  const activeCount = players.filter(p => p.connected && !p.isSpectator).length;
  el.playerCount.textContent = String(activeCount);

  clearChildren(el.playersList);

  players.forEach(p => {
    const row = document.createElement("div");
    row.className = "player-row";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name + (p.isSpectator ? " (spectator)" : "");

    const tag = document.createElement("div");
    tag.className = "pill";
    tag.textContent = p.isSpectator ? "watching" : (p.ready ? "Ready" : "Not ready");

    row.appendChild(name);
    row.appendChild(tag);
    el.playersList.appendChild(row);
  });
}

function renderQuestion(payload) {
  // payload is server "question" event
  state.answered = false;

  state.question = { text: payload.text, options: payload.options };
  state.meta = {
    startAt: payload.startAt,
    endAt: payload.endAt,
    qNumber: payload.qGlobal || 1,
    qTotal: payload.qGlobalTotal || 1,
    roundNumber: payload.roundNumber,
    roundCount: payload.roundCount,
    roundTitle: payload.roundTitle,
    qInRound: payload.qInRound,
    qInRoundTotal: payload.qInRoundTotal
  };

  showView(el.viewQuestion);
  setPhase("question");
  el.questionHint.textContent = "";
  el.questionText.textContent = state.question.text;

  setRoundLabel(el.roundLabel, state.meta);

  // options
  clearChildren(el.options);
  state.question.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = opt;
    btn.disabled = true;
    btn.onclick = () => submitAnswer(idx);
    el.options.appendChild(btn);
  });

  disableOptions();

  // timer
  startTimerBar(state.meta.startAt, state.meta.endAt);

  // fairness window
  const msToStart = Math.max(0, state.meta.startAt - Date.now());
  setTimeout(() => {
    // still on question screen?
    if (state.phase !== "question") return;
    el.questionHint.textContent = "Svar nu!";
    enableOptions();
  }, msToStart);
}

function submitAnswer(optionIndex) {
  if (state.answered) return;
  state.answered = true;

  disableOptions();
  el.questionHint.textContent = "✅ Svar sendt.";

  socket.emit("answer", { optionIndex, clientMs: Date.now() });
}

function renderReveal(payload) {
  showView(el.viewReveal);
  setPhase("reveal");
  stopTimer();

  // reset ready state
  state.me.ready = false;

  // enforce minimum reveal wait before enabling Ready (non-spectators only)
  el.readyAfterRevealBtn.disabled = true;
  const wait = Math.max(0, payload.revealMinMs || 0);
  setTimeout(() => {
    // Only enable if still in reveal view and not a spectator
    if (state.phase !== "reveal") return;
    el.readyAfterRevealBtn.disabled = state.me.isSpectator;
  }, wait);

  // round label
  const meta = {
    roundNumber: payload.roundNumber,
    roundCount: payload.roundCount,
    roundTitle: payload.roundTitle,
    qInRound: payload.qInRound,
    qInRoundTotal: payload.qInRoundTotal
  };
  setRoundLabel(el.revealRoundLabel, meta);

  // correct answer
  const correctIdx = payload.correctIndex;
  const correctOpt =
    state.question?.options && Number.isFinite(correctIdx)
      ? state.question.options[correctIdx]
      : "—";
  el.correctAnswer.textContent = correctOpt;

  // answers list
  clearChildren(el.revealList);

  (payload.answers || []).forEach(a => {
    const row = document.createElement("div");
    row.className = "reveal-row";

    const left = document.createElement("div");
    left.className = "reveal-name";
    left.textContent = a.name + (a.isSpectator ? " (spectator)" : "");

    const rightWrap = document.createElement("div");
    rightWrap.className = "reveal-right";

    const pill = document.createElement("div");
    pill.className = "pill";

    const didAnswer = a.optionIndex !== null && a.optionIndex !== undefined;
    const answerText =
      didAnswer && state.question?.options?.[a.optionIndex] != null
        ? state.question.options[a.optionIndex]
        : "No answer";

    pill.textContent = answerText;

    const marker = document.createElement("span");
    marker.style.marginLeft = "10px";
    marker.textContent = !didAnswer ? "⏳" : (a.isCorrect ? "✅" : "❌");

    rightWrap.appendChild(pill);
    rightWrap.appendChild(marker);

    row.appendChild(left);
    row.appendChild(rightWrap);
    el.revealList.appendChild(row);
  });

  el.revealHint.textContent = state.me.isSpectator
    ? "Du er spectator."
    : "Alle skal trykke Ready for næste spørgsmål.";
}


function renderFinal(scoreboard) {
  showView(el.viewFinal);
  setPhase("final");
  stopTimer();

  clearChildren(el.finalList);

  (scoreboard || []).forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "final-row";

    const left = document.createElement("div");
    left.textContent = `${i + 1}. ${p.name}`;

    const right = document.createElement("div");
    right.className = "pill";
    right.textContent = `${p.score} pts`;

    row.appendChild(left);
    row.appendChild(right);
    el.finalList.appendChild(row);
  });
}

// ---- Lobby actions ----
el.joinBtn.onclick = () => {
  const name = String(el.nameInput.value || "").trim().slice(0, 18);
  if (!name) {
    el.lobbyInfo.textContent = "Skriv et navn først 🙂";
    return;
  }
  state.me.name = name;
  socket.emit("join", { name });
  state.joined = true;
  el.lobbyInfo.textContent = "Joined.";
};

el.readyBtn.onclick = () => {
  if (state.me.isSpectator) return;

  state.me.ready = !state.me.ready;
  socket.emit("setReady", { ready: state.me.ready });

  el.readyBtn.textContent = state.me.ready ? "Unready" : "Ready";
  audio.playReady();
  vibrate(UI.VIBRATE_MS_READY || 0);
};

el.restartBtn.onclick = () => {
  // server guards host-only
  socket.emit("restartLobby");
};

// ---- Reveal ready ----
el.readyAfterRevealBtn.onclick = () => {
  if (state.me.isSpectator) return;
  if (state.me.ready) return;

  state.me.ready = true;
  socket.emit("setReady", { ready: true });

  el.readyAfterRevealBtn.disabled = true;
  audio.playReady();
  vibrate(UI.VIBRATE_MS_READY || 0);
};

// ---- Final restart ----
el.finalRestartBtn.onclick = () => {
  // server guards host-only
  socket.emit("restartLobby");
};

// ---- Socket events ----
socket.on("gameError", payload => {
  console.error("gameError:", payload);
  showView(el.viewLobby);
  setPhase("lobby");
  stopTimer();
  setRoundLabel(el.roundLabel, null);
  setRoundLabel(el.revealRoundLabel, null);
  el.lobbyInfo.textContent = payload?.message || "Game error.";
});

socket.on("state", data => {
  state.phase = data.phase || "lobby";
  setPhase(state.phase);
  if (data.version) setVersion(data.version);

  // update my spectator status if server includes my record
  if (Array.isArray(data.players)) {
    const me = data.players.find(p => p.id === socket.id);
    if (me) {
      state.me.isSpectator = !!me.isSpectator;
      el.youTag.textContent = state.me.isSpectator ? "spectator" : (state.me.ready ? "Ready" : "—");
    }
    renderPlayers(data.players);
  }

  // view switching based on phase
  if (state.phase === "lobby") {
    showView(el.viewLobby);
    stopTimer();
    setRoundLabel(el.roundLabel, null);
    setRoundLabel(el.revealRoundLabel, null);

    // spectators can't ready
    el.readyBtn.disabled = !!state.me.isSpectator;

    // keep button label consistent
    el.readyBtn.textContent = state.me.ready ? "Unready" : "Ready";
  }

  if (state.phase === "question") {
    // question event will also force this view,
    // but we allow phase-driven transitions too
    showView(el.viewQuestion);
  }

  if (state.phase === "reveal") {
    showView(el.viewReveal);
  }

  if (state.phase === "final") {
    showView(el.viewFinal);
  }
});

socket.on("question", payload => {
  state.phase = "question";
  renderQuestion(payload);
});

socket.on("reveal", payload => {
  state.phase = "reveal";
  renderReveal(payload);
});

socket.on("final", payload => {
  state.phase = "final";
  renderFinal(payload.scoreboard || []);
});
