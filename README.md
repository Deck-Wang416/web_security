# Five in a Row

A complete implementation of Homework 1 for Web Security (Fall 2026): a browser-based 19×19 Five-in-a-Row game with local play, authenticated online multiplayer, authoritative server validation, and a server-side AI opponent.

## Run the project

Requirements: Node.js 20 or newer. The application has no third-party runtime dependencies.

```bash
npm start
```

Open <http://localhost:3000> in a browser. For an online game, open a second browser window (or a private window), select **Online** in both, and the first player will be Black. Select **vs AI** for the bonus mode; the human always plays Black and moves first.

Run all automated tests with:

```bash
npm test
```

To use a different port: `PORT=8080 npm start`.

## Rubric coverage

### JavaScript client (50 points)

- A responsive HTML5 Canvas renders all 361 intersections of a traditional 19×19 board.
- Local two-player mode alternates Black and White, rejects occupied/out-of-range intersections, detects horizontal/vertical/both diagonal wins, and handles a full-board draw.
- A visible winning line, turn indicator, move count, and clear status messages make the game state unambiguous.
- Mouse, touch, and keyboard input are supported. Focus the board, use arrow keys, and press Enter or Space to place a stone.
- The page uses standards-based HTML/CSS/JavaScript supported by current Chrome, Edge, Firefox, and Safari, with no framework-specific browser assumptions.

### Server application (50 points)

- The Node.js server hosts the client, matches the first two online players, stores every authoritative game state in memory, and sends updates through same-origin AJAX polling.
- Each player receives a 256-bit cryptographically random bearer token. The token is required to read state, place a stone, or leave that game. Comparisons use timing-safe equality.
- The server independently validates game status, identity, turn, integer coordinates, board bounds, and empty occupancy. Client checks are for responsiveness only and are never trusted.
- Only the server mutates the online board or decides the winner. Both clients receive the same canonical state and a personal win/lose result.
- Request bodies are size-limited and JSON-validated. Static paths are normalized. CSP, anti-framing, MIME-sniffing, referrer, and same-origin resource headers are included.
- Finished and abandoned games are retained briefly for clients and then removed by periodic expiry.

### Bonus AI (10 points)

- The human is Black and moves first; AI is White.
- The AI first takes any immediate win, then blocks any immediate human win.
- Otherwise, it evaluates nearby legal intersections in all four directions. It heavily values open fours and open threes while balancing attack, defense, and center control.
- Its move is passed through the same authoritative `applyMove` validation and win-detection path as a network player's move.

## Architecture

```text
public/
  index.html             accessible application shell
  styles.css             responsive presentation
  js/app.js              Canvas renderer and local/network controller
  js/game-rules.js       shared board constants and win rules
src/
  server.js              HTTP static server and JSON API
  game-store.js          authentication, matchmaking, authoritative state
  ai.js                  server-side move selection
test/                     rules, AI, security, state, and HTTP tests
```

The rule module is shared by browser and server, while online state is not: clients only submit a requested coordinate. A typical online move follows this path:

```text
click → client legality hint → authenticated POST → server legality checks
      → server state mutation/win judgment → canonical JSON → both clients
```

## API summary

All game routes except creation require `Authorization: Bearer <player-token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/games` | Join/create a game with `{"mode":"online"}` or `{"mode":"ai"}` |
| `GET` | `/api/games/:id` | Fetch the authenticated player's current view |
| `POST` | `/api/games/:id/moves` | Request a move with `{"row":9,"column":9}` |
| `DELETE` | `/api/games/:id` | Mark the player disconnected |

Coordinates are zero-based integers from 0 through 18. Errors use an HTTP status plus `{ "error": "CODE", "message": "..." }`.

## Verification and demonstration checklist

1. Run `npm test`; all rule, AI, authentication, malicious-move, winner, and HTTP-header tests should pass.
2. Start the server and play a Local game through a five-stone win in each direction.
3. Open two windows, choose Online, and verify the first window is Black, cannot move twice, and the second window receives the move automatically.
4. In browser developer tools, confirm there are no console errors during Local, Online, and AI games.
5. Try clicking an occupied intersection and confirm it does not change the board.
6. Play vs AI and form four stones; confirm the AI blocks an open winning end unless it has its own immediate win.

Game state is intentionally in memory for a homework demonstration: restarting the Node process clears active games. No personal information or passwords are collected.
