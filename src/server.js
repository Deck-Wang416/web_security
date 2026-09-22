import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { GameError, GameStore } from "./game-store.js";

const PUBLIC_ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_BODY_BYTES = 10_000;
const store = new GameStore();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function securityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(response, status, value) {
  securityHeaders(response);
  response.writeHead(status, { "Content-Type": MIME_TYPES[".json"], "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function bearerToken(request) {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.authorization || "");
  return match?.[1] || "";
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new GameError(413, "BODY_TOO_LARGE", "Request body is too large.");
    }
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new GameError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

async function handleApi(request, response, url) {
  if (request.method === "POST" && url.pathname === "/api/games") {
    const body = await readJson(request);
    if (body.mode !== "online") {
      throw new GameError(400, "INVALID_MODE", "Mode must be online.");
    }
    sendJson(response, 201, store.joinOnline());
    return;
  }

  const match = /^\/api\/games\/([A-Za-z0-9_-]+)(\/moves)?$/.exec(url.pathname);
  if (!match) throw new GameError(404, "NOT_FOUND", "API route not found.");
  const [, gameId, moveRoute] = match;
  const token = bearerToken(request);

  if (request.method === "GET" && !moveRoute) {
    sendJson(response, 200, store.getState(gameId, token));
  } else if (request.method === "POST" && moveRoute) {
    const { row, column } = await readJson(request);
    sendJson(response, 200, store.makeMove(gameId, token, row, column));
  } else if (request.method === "DELETE" && !moveRoute) {
    sendJson(response, 200, store.leave(gameId, token));
  } else {
    throw new GameError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
}

function serveStatic(response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendJson(response, 400, { error: "INVALID_PATH", message: "Invalid URL path." });
    return;
  }
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(PUBLIC_ROOT, safePath);
  if (!filePath.startsWith(PUBLIC_ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(response, 404, { error: "NOT_FOUND", message: "File not found." });
    return;
  }

  securityHeaders(response);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
    "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=300"
  });
  createReadStream(filePath).pipe(response);
}

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
      else if (request.method === "GET" || request.method === "HEAD") serveStatic(response, url);
      else throw new GameError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error instanceof GameError ? error.status : 500;
      const code = error instanceof GameError ? error.code : "INTERNAL_ERROR";
      const message = error instanceof GameError ? error.message : "An unexpected error occurred.";
      if (status === 500) console.error(error);
      sendJson(response, status, { error: code, message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`Five in a Row is running at http://localhost:${PORT}`);
  });
  const cleanup = setInterval(() => store.removeExpired(), 30 * 60 * 1000);
  cleanup.unref();
}
