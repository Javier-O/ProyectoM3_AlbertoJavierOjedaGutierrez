// tests/app.test.js — lógica del router (src/app.js)
import { describe, it, expect } from "vitest";
import { resolveRoute } from "../src/app.js";

describe("resolveRoute", () => {
  it("respeta las rutas válidas", () => {
    expect(resolveRoute("/home")).toBe("/home");
    expect(resolveRoute("/chat")).toBe("/chat");
    expect(resolveRoute("/about")).toBe("/about");
  });

  it("manda la raíz '/' a /home", () => {
    expect(resolveRoute("/")).toBe("/home");
  });

  it("ignora la diagonal final", () => {
    expect(resolveRoute("/chat/")).toBe("/chat");
    expect(resolveRoute("/about///")).toBe("/about");
  });

  it("manda las rutas desconocidas a /home", () => {
    expect(resolveRoute("/xyz")).toBe("/home");
    expect(resolveRoute("/chat/otra-cosa")).toBe("/home");
  });
});
