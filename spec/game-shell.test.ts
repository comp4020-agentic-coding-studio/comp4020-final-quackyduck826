import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");

it("serves the game shell with a username input, colour picker and module script", async () => {
  const doc = new JSDOM(await (await fetch(new URL("/", baseUrl))).text()).window.document;
  expect(doc.querySelector("input#username")).not.toBeNull();
  expect(doc.querySelector("#colour-picker")).not.toBeNull();
  expect(doc.querySelector('script[type="module"]')).not.toBeNull();
});

it("serves the module script as JavaScript", async () => {
  const doc = new JSDOM(await (await fetch(new URL("/", baseUrl))).text()).window.document;
  const src = doc.querySelector('script[type="module"]')?.getAttribute("src") ?? "";
  const res = await fetch(new URL(src, baseUrl));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/javascript/);
});
