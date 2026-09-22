import test from "node:test";
import assert from "node:assert/strict";
import {
  BLACK,
  EMPTY,
  WHITE,
  createBoard,
  findWinningLine,
  isLegalMove,
  otherPlayer
} from "../public/js/game-rules.js";

test("creates an empty 19 by 19 board", () => {
  const board = createBoard();
  assert.equal(board.length, 19);
  assert.ok(board.every((row) => row.length === 19 && row.every((cell) => cell === EMPTY)));
  assert.notEqual(board[0], board[1], "rows must not share the same array");
});

test("accepts only empty in-bounds integer coordinates", () => {
  const board = createBoard();
  assert.equal(isLegalMove(board, 0, 0), true);
  board[0][0] = BLACK;
  assert.equal(isLegalMove(board, 0, 0), false);
  for (const coordinate of [-1, 19, 1.5, "1", null, undefined]) {
    assert.equal(isLegalMove(board, coordinate, 1), false);
    assert.equal(isLegalMove(board, 1, coordinate), false);
  }
});

test("detects horizontal, vertical, and both diagonal wins", () => {
  const patterns = [
    Array.from({ length: 5 }, (_, index) => [4, 3 + index]),
    Array.from({ length: 5 }, (_, index) => [3 + index, 4]),
    Array.from({ length: 5 }, (_, index) => [3 + index, 3 + index]),
    Array.from({ length: 5 }, (_, index) => [3 + index, 9 - index])
  ];
  for (const pattern of patterns) {
    const board = createBoard();
    pattern.forEach(([row, column]) => { board[row][column] = BLACK; });
    assert.deepEqual(findWinningLine(board, ...pattern[2], BLACK), pattern);
  }
});

test("does not report broken or four-stone lines", () => {
  const board = createBoard();
  [2, 3, 5, 6].forEach((column) => { board[7][column] = WHITE; });
  assert.equal(findWinningLine(board, 7, 5, WHITE), null);
  assert.equal(otherPlayer(BLACK), WHITE);
  assert.equal(otherPlayer(WHITE), BLACK);
});
