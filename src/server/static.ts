import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { ServerResponse } from "node:http";

export const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function send(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
  res.end(body);
}

// Serves a file under `root`; anything that escapes it or has an unknown
// extension is a 404.
export async function serveFile(res: ServerResponse, root: string, rel: string): Promise<void> {
  const path = normalize(join(root, rel));
  const type = TYPES[extname(path)];
  if (!path.startsWith(root + "/") || !type) return send(res, 404, "text/plain", "not found");
  try {
    send(res, 200, type, await readFile(path));
  } catch {
    send(res, 404, "text/plain", "not found");
  }
}
