import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WHITE,
  createBoard,
  findWinningLine,
  isLegalMove,
  otherPlayer
} from "../public/js/game-rules.js";
import { chooseAiMove } from "./ai.js";

const TOKEN_BYTES = 32;
const GAME_ID_BYTES = 12;

function randomId(bytes) {
  return randomBytes(bytes).toString("base64url");
}

function tokensMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const first = Buffer.from(provided);
  const second = Buffer.from(expected);
  return first.length === second.length && timingSafeEqual(first, second);
}

export class GameError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class GameStore {
  constructor() {
    this.games = new Map();
    this.waitingGameId = null;
  }

  joinOnline() {
    const waiting = this.games.get(this.waitingGameId);
    if (waiting?.status === "waiting" && !waiting.players[WHITE]) {
      const player = this.#createPlayer(WHITE);
      waiting.players[WHITE] = player;
      waiting.status = "active";
      waiting.updatedAt = Date.now();
      this.waitingGameId = null;
      return this.#joinResponse(waiting, player);
    }

    const game = this.#createGame("online");
    const player = this.#createPlayer(BLACK);
    game.players[BLACK] = player;
    game.status = "waiting";
    this.games.set(game.id, game);
    this.waitingGameId = game.id;
    return this.#joinResponse(game, player);
  }

  joinAi() {
    const game = this.#createGame("ai");
    const human = this.#createPlayer(BLACK);
    game.players[BLACK] = human;
    game.players[WHITE] = this.#createPlayer(WHITE);
    game.status = "active";
    this.games.set(game.id, game);
    return this.#joinResponse(game, human);
  }

  getState(gameId, token) {
    const game = this.#authenticatedGame(gameId, token);
    return this.#publicState(game, token);
  }

  makeMove(gameId, token, row, column) {
    const game = this.#authenticatedGame(gameId, token);
    const player = this.#playerForToken(game, token);
    this.applyMove(game, player.color, row, column);
    if (game.mode === "ai" && game.status === "active" && game.currentPlayer === WHITE) {
      const move = chooseAiMove(game.board);
      if (move) this.applyMove(game, WHITE, ...move);
    }
    return this.#publicState(game, token);
  }

  applyMove(game, color, row, column) {
    if (game.status !== "active") {
      throw new GameError(409, "GAME_NOT_ACTIVE", "The game is not active.");
    }
    if (game.currentPlayer !== color) {
      throw new GameError(409, "OUT_OF_TURN", "Wait for your turn.");
    }
    if (!isLegalMove(game.board, row, column)) {
      throw new GameError(400, "ILLEGAL_MOVE", "Choose an empty intersection on the board.");
    }

    game.board[row][column] = color;
    game.moves += 1;
    game.lastMove = { row, column, color };
    game.winningLine = findWinningLine(game.board, row, column, color);
    if (game.winningLine) {
      game.winner = color;
      game.status = "finished";
    } else if (game.moves === BOARD_SIZE * BOARD_SIZE) {
      game.status = "finished";
    } else {
      game.currentPlayer = otherPlayer(color);
    }
    game.updatedAt = Date.now();
    return game;
  }

  leave(gameId, token) {
    const game = this.#authenticatedGame(gameId, token);
    const player = this.#playerForToken(game, token);
    player.connected = false;
    game.updatedAt = Date.now();
    if (game.id === this.waitingGameId) this.waitingGameId = null;
    return { ok: true };
  }

  removeExpired(maxAgeMs = 4 * 60 * 60 * 1000) {
    const oldest = Date.now() - maxAgeMs;
    for (const [id, game] of this.games) {
      if (game.updatedAt < oldest) {
        this.games.delete(id);
        if (this.waitingGameId === id) this.waitingGameId = null;
      }
    }
  }

  #createGame(mode) {
    return {
      id: randomId(GAME_ID_BYTES),
      mode,
      board: createBoard(),
      currentPlayer: BLACK,
      winner: EMPTY,
      winningLine: null,
      lastMove: null,
      moves: 0,
      status: "waiting",
      players: { [BLACK]: null, [WHITE]: null },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  #createPlayer(color) {
    return { color, token: randomId(TOKEN_BYTES), connected: true };
  }

  #joinResponse(game, player) {
    return {
      gameId: game.id,
      token: player.token,
      ...this.#publicState(game, player.token)
    };
  }

  #authenticatedGame(gameId, token) {
    const game = this.games.get(gameId);
    if (!game) throw new GameError(404, "GAME_NOT_FOUND", "This game no longer exists.");
    if (!this.#playerForToken(game, token)) {
      throw new GameError(401, "UNAUTHORIZED", "Invalid player credentials.");
    }
    return game;
  }

  #playerForToken(game, token) {
    return Object.values(game.players).find((player) => player && tokensMatch(token, player.token));
  }

  #publicState(game, token) {
    const player = this.#playerForToken(game, token);
    return {
      id: game.id,
      mode: game.mode,
      board: game.board,
      currentPlayer: game.currentPlayer,
      winner: game.winner,
      winningLine: game.winningLine,
      lastMove: game.lastMove,
      moves: game.moves,
      status: game.status,
      you: player.color,
      opponentConnected: Boolean(game.players[otherPlayer(player.color)]?.connected)
    };
  }
}
