import { BLACK, BOARD_SIZE, EMPTY, WHITE, findWinningLine, isLegalMove } from "../public/js/game-rules.js";

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function legalMoves(board) {
  const occupied = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (board[row][column] !== EMPTY) occupied.push([row, column]);
    }
  }
  if (occupied.length === 0) return [[9, 9]];

  const candidates = new Map();
  for (const [row, column] of occupied) {
    for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
      for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (isLegalMove(board, nextRow, nextColumn)) {
          candidates.set(`${nextRow},${nextColumn}`, [nextRow, nextColumn]);
        }
      }
    }
  }
  return [...candidates.values()];
}

function wouldWin(board, row, column, color) {
  board[row][column] = color;
  const wins = Boolean(findWinningLine(board, row, column, color));
  board[row][column] = EMPTY;
  return wins;
}

function lineScore(board, row, column, color) {
  let total = 0;
  board[row][column] = color;
  for (const [rowStep, columnStep] of DIRECTIONS) {
    let length = 1;
    let openEnds = 0;
    for (const sign of [-1, 1]) {
      let distance = 1;
      while (board[row + rowStep * distance * sign]?.[column + columnStep * distance * sign] === color) {
        length += 1;
        distance += 1;
      }
      if (board[row + rowStep * distance * sign]?.[column + columnStep * distance * sign] === EMPTY) {
        openEnds += 1;
      }
    }

    if (length >= 5) total += 1_000_000;
    else if (length === 4 && openEnds === 2) total += 120_000;
    else if (length === 4 && openEnds === 1) total += 28_000;
    else if (length === 3 && openEnds === 2) total += 9_000;
    else if (length === 3 && openEnds === 1) total += 1_400;
    else if (length === 2 && openEnds === 2) total += 500;
    else total += length * length * (openEnds + 1);
  }
  board[row][column] = EMPTY;
  return total;
}

export function chooseAiMove(board) {
  const candidates = legalMoves(board);
  if (candidates.length === 0) return null;

  const winningMove = candidates.find(([row, column]) => wouldWin(board, row, column, WHITE));
  if (winningMove) return winningMove;

  const forcedBlock = candidates.find(([row, column]) => wouldWin(board, row, column, BLACK));
  if (forcedBlock) return forcedBlock;

  let bestMove = candidates[0];
  let bestScore = -Infinity;
  for (const [row, column] of candidates) {
    const attack = lineScore(board, row, column, WHITE);
    const defense = lineScore(board, row, column, BLACK);
    const centerPreference = 18 - (Math.abs(row - 9) + Math.abs(column - 9));
    const score = attack * 1.12 + defense + centerPreference;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [row, column];
    }
  }
  return bestMove;
}
