// tests/chat.test.js — petición del chat a la función serverless (src/chat.js)
// Mockeamos fetch: los tests no usan red ni gastan cuota de Gemini.
import { describe, it, expect, vi, afterEach } from "vitest";
import { requestReply } from "../src/chat.js";

// Construye una respuesta falsa como la que devolvería fetch
const fakeResponse = (ok, body) => ({ ok, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestReply", () => {
  it("envía el historial COMPLETO por POST a /api/functions y devuelve la respuesta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(true, { reply: "Hola, nene" }));
    vi.stubGlobal("fetch", fetchMock);

    const history = [
      { role: "user", text: "Me llamo Alberto" },
      { role: "model", text: "Encantado" },
      { role: "user", text: "¿Cómo me llamo?" },
    ];
    const reply = await requestReply(history);

    expect(reply).toBe("Hola, nene");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/functions");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ messages: history });
  });

  it("lanza el mensaje de error que mande el servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fakeResponse(false, { error: "Deadpool está saturado." }))
    );

    await expect(requestReply([{ role: "user", text: "Hola" }])).rejects.toThrow(
      "Deadpool está saturado."
    );
  });

  it("lanza un error genérico si el servidor falla sin mandar JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("no es JSON");
        },
      })
    );

    await expect(requestReply([{ role: "user", text: "Hola" }])).rejects.toThrow(
      /algo salió mal/i
    );
  });

  it("lanza error si la respuesta llega sin texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(true, {})));

    await expect(requestReply([{ role: "user", text: "Hola" }])).rejects.toThrow(/vacío/i);
  });

  it("deja pasar el error de red para que la interfaz lo muestre", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(requestReply([{ role: "user", text: "Hola" }])).rejects.toBeInstanceOf(TypeError);
  });
});
