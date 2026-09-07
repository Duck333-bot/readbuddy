import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./_core/index";

let server: Server | undefined;

async function startTestServer() {
  server = createServer(createApp());
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server?.close(error => (error ? reject(error) : resolve())));
  server = undefined;
});

describe("Vercel Express entrypoint", () => {
  it("creates the production app without binding a port and retains the health route", async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

