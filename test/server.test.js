import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";

async function withServer(run) {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("serves the application with defensive browser headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(await response.text(), /Five in a Row/);
  });
});

test("API rejects malformed input and forged credentials without leaking details", async () => {
  await withServer(async (baseUrl) => {
    const invalidJson = await fetch(`${baseUrl}/api/games`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{"
    });
    assert.equal(invalidJson.status, 400);
    const joinedResponse = await fetch(`${baseUrl}/api/games`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "ai" })
    });
    const joined = await joinedResponse.json();
    const forged = await fetch(`${baseUrl}/api/games/${joined.gameId}`, {
      headers: { Authorization: "Bearer forged-token" }
    });
    assert.equal(forged.status, 401);
    assert.deepEqual(await forged.json(), { error: "UNAUTHORIZED", message: "Invalid player credentials." });
  });
});
