import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WHITE,
  createBoard,
  findWinningLine,
  isLegalMove,
  otherPlayer,
  playerName
} from "./game-rules.js";

const canvas = document.querySelector("#board");
const context = canvas.getContext("2d");
const statusElement = document.querySelector("#status");
const moveCountElement = document.querySelector("#move-count");
const newGameButton = document.querySelector("#new-game");
const playerCards = [...document.querySelectorAll(".player-card")];
const modeButtons = [...document.querySelectorAll(".mode-button")];
const connectionElement = document.querySelector("#connection");
const connectionLabel = document.querySelector("#connection-label");
const noticeElement = document.querySelector("#notice");

const state = {
  board: createBoard(),
  currentPlayer: BLACK,
  winner: EMPTY,
  winningLine: null,
  moves: 0,
  cursor: { row: 9, column: 9 },
  mode: "local",
  gameStatus: "active",
  gameId: null,
  token: null,
  you: null,
  opponentConnected: false,
  requestPending: false
};

let pollTimer = null;
let sessionVersion = 0;

const geometry = { padding: 34, gap: 0 };

function resizeCanvas() {
  const size = Math.max(280, Math.round(canvas.getBoundingClientRect().width));
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  geometry.padding = Math.max(20, size * 0.045);
  geometry.gap = (size - geometry.padding * 2) / (BOARD_SIZE - 1);
  draw(size);
}

function draw(size = canvas.getBoundingClientRect().width) {
  context.clearRect(0, 0, size, size);
  drawGrid();
  drawStarPoints();
  drawStones();
  if (document.activeElement === canvas && !state.winner) drawCursor();
  if (state.winningLine) drawWinningLine();
}

function point(row, column) {
  return {
    x: geometry.padding + column * geometry.gap,
    y: geometry.padding + row * geometry.gap
  };
}

function drawGrid() {
  const end = geometry.padding + geometry.gap * (BOARD_SIZE - 1);
  context.beginPath();
  context.strokeStyle = "rgba(42, 35, 23, 0.73)";
  context.lineWidth = 1;
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const offset = geometry.padding + index * geometry.gap;
    context.moveTo(geometry.padding, offset);
    context.lineTo(end, offset);
    context.moveTo(offset, geometry.padding);
    context.lineTo(offset, end);
  }
  context.stroke();
}

function drawStarPoints() {
  context.fillStyle = "#3d3221";
  for (const row of [3, 9, 15]) {
    for (const column of [3, 9, 15]) {
      const { x, y } = point(row, column);
      context.beginPath();
      context.arc(x, y, Math.max(2.5, geometry.gap * 0.1), 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawStones() {
  const radius = geometry.gap * 0.43;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const player = state.board[row][column];
      if (player === EMPTY) continue;
      const { x, y } = point(row, column);
      const gradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.4, 1, x, y, radius);
      if (player === BLACK) {
        gradient.addColorStop(0, "#5d645f");
        gradient.addColorStop(0.58, "#1c211e");
        gradient.addColorStop(1, "#090c0a");
      } else {
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.68, "#e9e7dd");
        gradient.addColorStop(1, "#bdbbb1");
      }
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.shadowColor = "rgba(0, 0, 0, 0.26)";
      context.shadowBlur = 4;
      context.shadowOffsetY = 2;
      context.fill();
      context.shadowColor = "transparent";
    }
  }
}

function drawCursor() {
  const { x, y } = point(state.cursor.row, state.cursor.column);
  context.beginPath();
  context.arc(x, y, geometry.gap * 0.48, 0, Math.PI * 2);
  context.strokeStyle = "#0b6572";
  context.lineWidth = 3;
  context.stroke();
}

function drawWinningLine() {
  const first = point(...state.winningLine[0]);
  const last = point(...state.winningLine[state.winningLine.length - 1]);
  context.beginPath();
  context.moveTo(first.x, first.y);
  context.lineTo(last.x, last.y);
  context.strokeStyle = "#c83822";
  context.lineCap = "round";
  context.lineWidth = Math.max(3, geometry.gap * 0.14);
  context.stroke();
}

async function attemptMove(row, column) {
  if (state.winner || !isLegalMove(state.board, row, column)) return;
  if (state.mode === "online") {
    if (state.gameStatus !== "active" || state.currentPlayer !== state.you || state.requestPending) return;
    state.requestPending = true;
    try {
      const serverState = await api(`/api/games/${state.gameId}/moves`, {
        method: "POST",
        body: JSON.stringify({ row, column })
      });
      applyServerState(serverState);
    } catch (error) {
      showNotice(error.message);
      await pollGame();
    } finally {
      state.requestPending = false;
    }
    return;
  }

  const player = state.currentPlayer;
  state.board[row][column] = player;
  state.moves += 1;
  state.winningLine = findWinningLine(state.board, row, column, player);
  if (state.winningLine) state.winner = player;
  else if (state.moves < BOARD_SIZE * BOARD_SIZE) state.currentPlayer = otherPlayer(player);
  updateInterface();
}

function updateInterface() {
  const isDraw = !state.winner && state.moves === BOARD_SIZE * BOARD_SIZE;
  if (state.mode === "online" && state.gameStatus === "waiting") {
    statusElement.textContent = "Waiting for an opponent…";
  } else if (state.winner) {
    statusElement.textContent = state.mode === "online"
      ? (state.winner === state.you ? "You win!" : "You lose")
      : `${playerName(state.winner)} wins!`;
  } else if (isDraw) {
    statusElement.textContent = "Draw game";
  } else if (state.mode === "online") {
    statusElement.textContent = state.currentPlayer === state.you
      ? `Your turn · ${playerName(state.you)}`
      : `${playerName(state.currentPlayer)} is thinking…`;
  } else {
    statusElement.textContent = `${playerName(state.currentPlayer)} to move`;
  }
  moveCountElement.textContent = state.winner || isDraw
    ? `${state.moves} moves played`
    : state.gameStatus === "waiting" ? "You are Black and move first" : `Move ${state.moves + 1}`;
  playerCards.forEach((card, index) => {
    const player = index === 0 ? BLACK : WHITE;
    card.classList.toggle("current", state.gameStatus === "active" && !state.winner && !isDraw && state.currentPlayer === player);
    const name = card.querySelector(".player-name");
    const detail = card.querySelector(".player-detail");
    if (state.mode === "online") {
      name.textContent = player === state.you ? "You" : "Opponent";
      detail.textContent = `${playerName(player)}${player === BLACK ? " · first" : ""}`;
    } else {
      name.textContent = playerName(player);
      detail.textContent = `Player ${player}${player === BLACK ? " · first" : ""}`;
    }
  });
  canvas.setAttribute("aria-label", boardLabel(isDraw));
  draw();
}

function boardLabel(isDraw) {
  if (state.winner) return `19 by 19 board. ${playerName(state.winner)} wins after ${state.moves} moves.`;
  if (isDraw) return "19 by 19 board. The game is a draw.";
  return `19 by 19 board with ${state.moves} stones. ${playerName(state.currentPlayer)} to move. Keyboard cursor at row ${state.cursor.row + 1}, column ${state.cursor.column + 1}.`;
}

function applyServerState(serverState) {
  Object.assign(state, {
    board: serverState.board,
    currentPlayer: serverState.currentPlayer,
    winner: serverState.winner,
    winningLine: serverState.winningLine,
    moves: serverState.moves,
    gameStatus: serverState.status,
    you: serverState.you,
    opponentConnected: serverState.opponentConnected
  });
  connectionElement.className = `connection ${serverState.status === "waiting" ? "waiting" : "online"}`;
  connectionLabel.textContent = serverState.status === "waiting" ? "Waiting for player" : "Online match";
  updateInterface();
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

async function pollGame(version = sessionVersion) {
  if (state.mode !== "online" || !state.gameId || version !== sessionVersion) return;
  try {
    const serverState = await api(`/api/games/${state.gameId}`);
    if (version === sessionVersion) applyServerState(serverState);
  } catch (error) {
    if (version === sessionVersion) showNotice(error.message);
  }
}

async function startMode(mode) {
  sessionVersion += 1;
  const version = sessionVersion;
  clearInterval(pollTimer);
  pollTimer = null;
  hideNotice();
  resetBoard();
  state.mode = mode;
  state.gameId = null;
  state.token = null;
  state.you = null;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (mode === "local") {
    state.gameStatus = "active";
    connectionElement.className = "connection";
    connectionLabel.textContent = "Local game";
    newGameButton.textContent = "New game";
    updateInterface();
    return;
  }

  state.gameStatus = "waiting";
  connectionElement.className = "connection waiting";
  connectionLabel.textContent = "Joining…";
  statusElement.textContent = "Joining an online match…";
  newGameButton.textContent = "Find new match";
  try {
    const joined = await api("/api/games", { method: "POST", body: JSON.stringify({ mode }) });
    if (version !== sessionVersion) return;
    state.gameId = joined.gameId;
    state.token = joined.token;
    applyServerState(joined);
    pollTimer = setInterval(() => pollGame(version), 700);
  } catch (error) {
    if (version !== sessionVersion) return;
    state.gameStatus = "waiting";
    connectionElement.className = "connection";
    connectionLabel.textContent = "Offline";
    statusElement.textContent = "Could not join";
    showNotice(`${error.message} Start the Node.js server and try again.`);
  }
}

function resetBoard() {
  Object.assign(state, {
    board: createBoard(), currentPlayer: BLACK, winner: EMPTY, winningLine: null, moves: 0,
    gameStatus: "active", opponentConnected: false, requestPending: false
  });
}

function showNotice(message) {
  noticeElement.textContent = message;
  noticeElement.hidden = false;
}

function hideNotice() {
  noticeElement.hidden = true;
  noticeElement.textContent = "";
}

function eventCoordinate(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const column = Math.round((x - geometry.padding) / geometry.gap);
  const row = Math.round((y - geometry.padding) / geometry.gap);
  const target = point(row, column);
  if (Math.hypot(x - target.x, y - target.y) > geometry.gap * 0.48) return null;
  return { row, column };
}

canvas.addEventListener("click", (event) => {
  const coordinate = eventCoordinate(event);
  if (coordinate) {
    state.cursor = coordinate;
    attemptMove(coordinate.row, coordinate.column);
  }
});

canvas.addEventListener("keydown", (event) => {
  const movement = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
  }[event.key];
  if (movement) {
    event.preventDefault();
    state.cursor.row = Math.max(0, Math.min(BOARD_SIZE - 1, state.cursor.row + movement[0]));
    state.cursor.column = Math.max(0, Math.min(BOARD_SIZE - 1, state.cursor.column + movement[1]));
    canvas.setAttribute("aria-label", boardLabel(false));
    draw();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    attemptMove(state.cursor.row, state.cursor.column);
  }
});

canvas.addEventListener("focus", () => draw());
canvas.addEventListener("blur", () => draw());
newGameButton.addEventListener("click", () => {
  startMode(state.mode);
  canvas.focus();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => startMode(button.dataset.mode));
});

new ResizeObserver(resizeCanvas).observe(canvas);
updateInterface();
