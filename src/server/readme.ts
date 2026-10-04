import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { render } from "./markdown.ts";
import { send } from "./static.ts";

export async function serveReadme(res: ServerResponse, root: string): Promise<void> {
  const md = await readFile(root + "/README.md", "utf8");
  send(
    res,
    200,
    "text/html; charset=utf-8",
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reef: README</title><link rel="stylesheet" href="/style.css"></head><body class="doc"><main>${render(md)}</main></body></html>`,
  );
}
