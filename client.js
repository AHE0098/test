// client.js
// =====================
// Client: UI + Socket events (matches current server.js events/payloads)
// =====================

const UI = window.UI_CFG || { TIMER_TICK_MS: 50 };

// ---- DOM ----
const el = {
  version: document.getElementById("version"),
  phaseBadge: document.getElementById("phaseBadge"),

  screenLobby: document.getElementById("screenLobby"),
  screenQuestion: document.getElementById("screenQuestion"),
  screenReveal: document.getElementById("screenReveal"),
  screenGameOver: document.getElementById("screenGameOver"),

  playerList: document.getElementById("playerList"),
  btnReadyLobby: document.getElementById("btnReadyLobby"),
  lobbyHint: document.getElementById("lobbyHint"),

  roundLabel: document.getElementById("roundLabel"),
  qCounter: document.getElementById("qCounter"),
  qStatus: document.getElementById("qStatus"),
  qText: document.getElementById("qText"),
  options: document.getElementById("options"),
  answerHint: document.getElementById("answerHint"),
  timerBar: document.getElementById("timerBar"),

  correctText: document.getElementById("correctText"),
  revealList: document.getElementById("revealList"),
  btnReadyReveal: document.getElementById("btnReadyReveal"),
  revealHint: document.getElementById("revealHint"),

  finalList: document.getElementById("finalList")
};

// ---- Simple FX chunk ----
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
  phase: "lobby",
  me: { name: "", spectator: false, ready: false },
  timerInterval: null,
  answered: false,
  meta: null,
  question: null
};

// ---- Socket ----
const socket = io();

function askName() {
  const raw = prompt("Navn (max 24 tegn):") || "Player";
  return raw.toString().slice(0, 24);
}

state.me.name = askName();
socket.emit("join", { name: state.me.name });

// ---- UI helpers ----
function setPhaseBadge(text) {
  el.phaseBadge.textContent = text;
}

function showScreen(which) {
  el.screenLobby.classList.add("hidden");
  el.screenQuestion.classList.add("hidden");
  el.screenReveal.classList.add("hidden");
  el.screenGameOver.classList.add("hidden");
  which.classList.remove("hidden");
}

function setRoundLabel(meta) {
  if (!el.roundLabel) return;

  if (!meta || !meta.roundNumber || !meta.roundCount) {
    el.roundLabel.style.display = "none";
    el.roundLabel.textContent = "";
    return;
  }

  const title = meta.roundTitle ? ` — ${meta.roundTitle}` : "";
  const qPart =
    meta.qInRound && meta.qInRoundTotal ? ` • Q ${meta.qInRound}/${meta.qInRoundTotal}` : "";

  el.roundLabel.textContent = `Round ${meta.roundNumber}/${meta.roundCount}${title}${qPart}`;
  el.roundLabel.style.display = "block";
}

function hideRoundLabel() {
  if (!el.roundLabel) return;
  el.roundLabel.style.display = "none";
  el.roundLabel.textContent = "";
}

function renderPlayerList(players) {
  el.playerList.innerHTML = "";
  players.forEach(p => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    left.textContent = p.name + (p.spectator ? " (spectator)" : "");

    const right = document.createElement("div");
    right.className = "pill";
    right.textContent = p.spectator ? "watching" : (p.ready ? "Ready" : "Not ready");

    row.appendChild(left);
    row.appendChild(right);
    el.playerList.appendChild(row);
  });
}

function clearOptions() {
  el.options.innerHTML = "";
}

function setOptionsEnabled(enabled) {
  [...el.options.querySelectorAll("button")].forEach(b => (b.disabled = !enabled));
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
    el.timerBar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

    if (now >= endAt) {
      stopTimer();
      setOptionsEnabled(false);
      if (!state.answered) el.answerHint.textContent = "⏳ Tiden er gået.";
    }
  }

  tick();
  state.timerInterval = setInterval(tick, UI.TIMER_TICK_MS || 50);
}

function renderQuestion(question, meta) {
  state.answered = false;
  state.question = question;
  state.meta = meta;

  setRoundLabel(meta);

  el.qCounter.textContent = `Spørgsmål ${meta.qNumber}/${meta.qTotal}`;
  el.qStatus.textContent = "Gør klar...";
  el.qText.textContent = question.text;
  el.answerHint.textContent = "";
  clearOptions();

  question.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn option";
    btn.textContent = opt;
    btn.disabled = true;
    btn.onclick = () => submitAnswer(idx);
    el.options.appendChild(btn);
  });

  setOptionsEnabled(false);
  startTimerBar(meta.startAt, meta.endAt);

  const msToStart = Math.max(0, meta.startAt - Date.now());
  setTimeout(() => {
    el.qStatus.textContent = "Svar nu!";
    setOptionsEnabled(true);
  }, msToStart);
}

function submitAnswer(answerIndex) {
  if (state.answered) return;
  state.answered = true;
  setOptionsEnabled(false);
  el.answerHint.textContent = "✅ Svar sendt.";

  // server expects: { optionIndex, clientMs }
  socket.emit("answer", { optionIndex: answerIndex, clientMs: Date.now() });
}

function renderReveal(payload) {
  // server sends correctIndex + answers[] with optionIndex, isCorrect, etc.
  const correctIdx = payload.correctIndex;
  const correctOpt =
    state.question && state.question.options && Number.isFinite(correctIdx)
      ? state.question.options[correctIdx]
      : "(unknown)";
  el.correctText.textContent = `✅ Correct: ${correctOpt}`;

  el.revealList.innerHTML = "";

  (payload.answers || []).forEach(a => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    left.textContent = a.name + (a.isSpectator ? " (spectator)" : "");

    const right = document.createElement("div");
    right.className = "pill";

    const didAnswer = a.optionIndex !== null && a.optionIndex !== undefined;
    const answerText =
      didAnswer && state.question?.options?.[a.optionIndex] != null
        ? state.question.options[a.optionIndex]
        : "No answer";

    right.textContent = answerText;

    const marker = document.createElement("span");
    marker.style.marginLeft = "10px";
    marker.textContent = !didAnswer ? "⏳" : a.isCorrect ? "✅" : "❌";

    row.appendChild(left);

    const rWrap = document.createElement("div");
    rWrap.style.display = "flex";
    rWrap.style.alignItems = "center";
    rWrap.appendChild(right);
    rWrap.appendChild(marker);

    row.appendChild(rWrap);
    el.revealList.appendChild(row);
  });

  el.btnReadyReveal.disabled = state.me.ready;
  el.revealHint.textContent = "Alle skal trykke Ready for næste spørgsmål.";
}

function renderFinal(finalRows) {
  el.finalList.innerHTML = "";
  finalRows.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "list-item";

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

// ---- Buttons ----
el.btnReadyLobby.onclick = () => {
  state.me.ready = !state.me.ready;

  // server expects: { ready }
  socket.emit("setReady", { ready: state.me.ready });

  el.btnReadyLobby.textContent = state.me.ready ? "Unready" : "Ready";
  audio.playReady();
  vibrate(UI.VIBRATE_MS_READY || 0);
};

el.btnReadyReveal.onclick = () => {
  if (state.me.ready) return;
  state.me.ready = true;

  // server expects: { ready }
  socket.emit("setReady", { ready: true });

  el.btnReadyReveal.disabled = true;
  audio.playReady();
  vibrate(UI.VIBRATE_MS_READY || 0);
};

// ---- Socket events ----
socket.on("gameError", payload => {
  // Non-blocking: show lobby + hint
  console.error("gameError:", payload);
  el.lobbyHint.textContent = payload?.message || "Game error.";
  showScreen(el.screenLobby);
  hideRoundLabel();
  stopTimer();
});

socket.on("state", data => {
  state.phase = data.phase || "lobby";
  setPhaseBadge(state.phase);

  if (data.version) el.version.textContent = data.version;

  // server uses isSpectator, client UI expects spectator
  if (Array.isArray(data.players)) {
    const mapped = data.players.map(p => ({
      name: p.name,
      spectator: !!p.isSpectator,
      ready: !!p.ready
    }));
    renderPlayerList(mapped);

    // update my spectator status if present
    const me = data.players.find(p => p.id === socket.id);
    if (me) state.me.spectator = !!me.isSpectator;
  }

  if (state.phase === "lobby") {
    hideRoundLabel();
    showScreen(el.screenLobby);

    // reset ready button UI locally
    state.me.ready = false;
    el.btnReadyLobby.textContent = "Ready";
    el.btnReadyLobby.disabled = !!state.me.spectator;

    el.btnReadyReveal.disabled = false;
    stopTimer();
  }

  if (state.phase === "question") {
    showScreen(el.screenQuestion);
  }

  if (state.phase === "reveal") {
    hideRoundLabel();
    showScreen(el.screenReveal);
  }

  if (state.phase === "final") {
    hideRoundLabel();
    showScreen(el.screenGameOver);
  }
});

socket.on("question", payload => {
  setPhaseBadge("question");
  showScreen(el.screenQuestion);
  stopTimer();

  state.me.ready = false;
  el.btnReadyReveal.disabled = false;

  const question = { text: payload.text, options: payload.options };
  const meta = {
    startAt: payload.startAt,
    endAt: payload.endAt,

    // global counters
    qNumber: payload.qGlobal || 1,
    qTotal: payload.qGlobalTotal || 1,

    // rounds
    roundNumber: payload.roundNumber,
    roundCount: payload.roundCount,
    roundTitle: payload.roundTitle,
    qInRound: payload.qInRound,
    qInRoundTotal: payload.qInRoundTotal
  };

  renderQuestion(question, meta);
});

socket.on("reveal", payload => {
  setPhaseBadge("reveal");
  showScreen(el.screenReveal);
  stopTimer();

  state.me.ready = false;
  renderReveal(payload);
});

socket.on("final", payload => {
  setPhaseBadge("final");
  showScreen(el.screenGameOver);
  stopTimer();
  hideRoundLabel();

  renderFinal(payload.scoreboard || []);
});
