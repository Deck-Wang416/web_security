import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, WHITE, createBoard } from "../public/js/game-rules.js";
import { chooseAiMove } from "../src/ai.js";

function includesMove(actual, expected) {
  return expected.some(([row, column]) => actual[0] === row && actual[1] === column);
}

test("AI takes an immediate winning move", () => {
  const board = createBoard();
  for (let column = 5; column <= 8; column += 1) board[8][column] = WHITE;
  assert.equal(includesMove(chooseAiMove(board), [[8, 4], [8, 9]]), true);
});

test("AI blocks the human's immediate horizontal and diagonal wins", () => {
  const horizontal = createBoard();
  for (let column = 5; column <= 8; column += 1) horizontal[9][column] = BLACK;
  assert.equal(includesMove(chooseAiMove(horizontal), [[9, 4], [9, 9]]), true);

  const diagonal = createBoard();
  for (let offset = 0; offset < 4; offset += 1) diagonal[5 + offset][5 + offset] = BLACK;
  assert.equal(includesMove(chooseAiMove(diagonal), [[4, 4], [9, 9]]), true);
});

test("AI prefers extending a useful line on a quiet board", () => {
  const board = createBoard();
  board[9][9] = BLACK;
  board[8][8] = WHITE;
  board[8][9] = WHITE;
  const [row, column] = chooseAiMove(board);
  assert.equal(Math.max(Math.abs(row - 8), Math.abs(column - 8.5)) <= 2, true);
});
