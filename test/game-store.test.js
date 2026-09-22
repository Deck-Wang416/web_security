import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, WHITE } from "../public/js/game-rules.js";
import { GameError, GameStore } from "../src/game-store.js";

test("matches two online players and authenticates their private tokens", () => {
  const store = new GameStore();
  const black = store.joinOnline();
  assert.equal(black.status, "waiting");
  assert.equal(black.you, BLACK);
  const white = store.joinOnline();
  assert.equal(white.gameId, black.gameId);
  assert.equal(white.status, "active");
  assert.equal(white.you, WHITE);
  assert.notEqual(white.token, black.token);
  assert.throws(
    () => store.getState(black.gameId, "forged-token"),
    (error) => error instanceof GameError && error.status === 401
  );
});

test("authoritative server rejects out-of-turn, occupied, and invalid moves", () => {
  const store = new GameStore();
  const black = store.joinOnline();
  const white = store.joinOnline();
  assert.throws(() => store.makeMove(black.gameId, white.token, 9, 9), { code: "OUT_OF_TURN" });
  store.makeMove(black.gameId, black.token, 9, 9);
  assert.throws(() => store.makeMove(black.gameId, black.token, 9, 10), { code: "OUT_OF_TURN" });
  assert.throws(() => store.makeMove(black.gameId, white.token, 9, 9), { code: "ILLEGAL_MOVE" });
  assert.throws(() => store.makeMove(black.gameId, white.token, -1, 0), { code: "ILLEGAL_MOVE" });
});

test("server declares the winner and refuses moves after the game", () => {
  const store = new GameStore();
  const black = store.joinOnline();
  const white = store.joinOnline();
  for (let column = 0; column < 4; column += 1) {
    store.makeMove(black.gameId, black.token, 2, column);
    store.makeMove(black.gameId, white.token, 12, column);
  }
  const result = store.makeMove(black.gameId, black.token, 2, 4);
  assert.equal(result.winner, BLACK);
  assert.equal(result.status, "finished");
  assert.equal(result.winningLine.length, 5);
  assert.throws(() => store.makeMove(black.gameId, white.token, 12, 4), { code: "GAME_NOT_ACTIVE" });
});

test("AI games make a validated white response after each human turn", () => {
  const store = new GameStore();
  const game = store.joinAi();
  const result = store.makeMove(game.gameId, game.token, 9, 9);
  assert.equal(result.moves, 2);
  assert.equal(result.board[9][9], BLACK);
  assert.equal(result.currentPlayer, BLACK);
  assert.equal(result.board.flat().filter((cell) => cell === WHITE).length, 1);
});
