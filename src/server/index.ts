import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORT } from "./env.ts";
import { parseSubmission, submit, top } from "./leaderboard.ts";
import { serveReadme } from "./readme.ts";
import { send, serveFile } from "./static.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const publicDir = join(root, "public");

async function readBody(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error("too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const json = (body: unknown): string => JSON.stringify(body);

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? "/", "http://x");
    const method = req.method ?? "GET";

    if (pathname === "/api/leaderboard") {
      if (method === "GET") return send(res, 200, "application/json", json({ entries: top() }));
      if (method === "POST") {
        let body: unknown;
        try {
          body = await readBody(req);
        } catch {
          return send(res, 400, "application/json", json({ error: "invalid JSON body" }));
        }
        const parsed = parseSubmission(body);
        if (!parsed.ok) return send(res, 400, "application/json", json({ error: parsed.error }));
        return send(res, 200, "application/json", json({ entries: await submit(parsed.entry) }));
      }
      return send(res, 405, "text/plain", "method not allowed");
    }

    if (method !== "GET" && method !== "HEAD") return send(res, 405, "text/plain", "method not allowed");

    if (pathname === "/readme") {
      res.writeHead(301, { location: "/readme/" });
      return res.end();
    }
    if (pathname === "/readme/") return await serveReadme(res, root);
    if (pathname.startsWith("/readme/")) {
      return await serveFile(res, join(root, "docs"), decodeURIComponent(pathname.slice("/readme/".length)).replace(/^docs\//, ""));
    }
    if (pathname.startsWith("/docs/")) return await serveFile(res, join(root, "docs"), pathname.slice(6));

    return await serveFile(res, publicDir, pathname === "/" ? "index.html" : decodeURIComponent(pathname));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, "text/plain", "internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`reef listening on :${PORT}`));
