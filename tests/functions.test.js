// tests/functions.test.js — función serverless (api/functions.js)
// Probamos el "handler" con req/res falsos y fetch mockeado: sin red y sin API key real.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../api/functions.js";

const FAKE_KEY = "CLAVE_FALSA_DE_PRUEBA";

// res falso que recuerda el código y el cuerpo que se le asignaron
function createRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

const postRequest = (messages) => ({ method: "POST", body: { messages } });
const validMessages = [{ role: "user", text: "Hola" }];

const geminiOk = {
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: "Hola, nene" }] } }] }),
};
const gemini503 = { ok: false, status: 503, json: async () => ({}) };

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", FAKE_KEY);
  vi.stubEnv("GEMINI_MODEL", "");
  vi.stubEnv("GEMINI_FALLBACK_MODEL", "");
  vi.spyOn(console, "error").mockImplementation(() => {}); // silencia los logs esperados
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handler de /api/functions", () => {
  it("solo acepta POST", async () => {
    const res = createRes();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
  });

  it("responde 500 si el servidor no tiene API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = createRes();
    await handler(postRequest(validMessages), res);

    expect(res.statusCode).toBe(500);
  });

  it("responde 400 si el historial es inválido, sin llamar a Gemini", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = createRes();
    await handler(postRequest([{ role: "model", text: "Hola" }]), res);

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("llama a Gemini con la key en el header (nunca en la URL), el system prompt y el historial", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiOk);
    vi.stubGlobal("fetch", fetchMock);

    const res = createRes();
    await handler(postRequest(validMessages), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ reply: "Hola, nene" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain(FAKE_KEY);
    expect(options.headers["x-goog-api-key"]).toBe(FAKE_KEY);

    const sent = JSON.parse(options.body);
    expect(sent.systemInstruction.parts[0].text).toMatch(/Deadpool/);
    expect(sent.contents).toEqual([{ role: "user", parts: [{ text: "Hola" }] }]);
  });

  it("si el modelo principal está saturado (503), usa el de respaldo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(gemini503).mockResolvedValueOnce(geminiOk);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_MODEL", "modelo-principal");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "modelo-respaldo");

    const res = createRes();
    await handler(postRequest(validMessages), res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("modelo-principal");
    expect(fetchMock.mock.calls[1][0]).toContain("modelo-respaldo");
  });

  it("responde 504 si ningún modelo contesta a tiempo", async () => {
    const timeoutError = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    const res = createRes();
    await handler(postRequest(validMessages), res);

    expect(res.statusCode).toBe(504);
  });

  it("traduce el límite de uso de Gemini (429) a un mensaje amigable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));

    const res = createRes();
    await handler(postRequest(validMessages), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/saturado/i);
  });
});
