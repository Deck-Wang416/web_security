export const BOARD_SIZE = 19;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

export function isCoordinate(value) {
  return Number.isInteger(value) && value >= 0 && value < BOARD_SIZE;
}

export function isLegalMove(board, row, column) {
  return isCoordinate(row) && isCoordinate(column) && board[row]?.[column] === EMPTY;
}

export function findWinningLine(board, row, column, player) {
  if (!isCoordinate(row) || !isCoordinate(column) || board[row]?.[column] !== player) return null;

  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [rowStep, columnStep] of directions) {
    const line = [[row, column]];

    for (const sign of [-1, 1]) {
      let nextRow = row + rowStep * sign;
      let nextColumn = column + columnStep * sign;
      const side = [];
      while (board[nextRow]?.[nextColumn] === player) {
        side.push([nextRow, nextColumn]);
        nextRow += rowStep * sign;
        nextColumn += columnStep * sign;
      }
      if (sign === -1) line.unshift(...side.reverse());
      else line.push(...side);
    }

    if (line.length >= 5) return line;
  }
  return null;
}

export function otherPlayer(player) {
  return player === BLACK ? WHITE : BLACK;
}

export function playerName(player) {
  return player === BLACK ? "Black" : "White";
}
