// tests/utils.test.js — funciones puras de transformación (src/utils.js)
import { describe, it, expect } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  createMessage,
  cleanUserInput,
  validateMessages,
  toGeminiContents,
  extractReplyText,
} from "../src/utils.js";

describe("createMessage", () => {
  it("crea un mensaje con el rol y el texto indicados", () => {
    expect(createMessage("user", "Hola")).toEqual({ role: "user", text: "Hola" });
  });
});

describe("cleanUserInput", () => {
  it("quita los espacios al inicio y al final", () => {
    expect(cleanUserInput("   hola  ")).toBe("hola");
  });

  it("devuelve cadena vacía si no hay nada que enviar", () => {
    expect(cleanUserInput("    ")).toBe("");
    expect(cleanUserInput(null)).toBe("");
    expect(cleanUserInput(undefined)).toBe("");
  });

  it("recorta los mensajes que superan el largo máximo", () => {
    const result = cleanUserInput("a".repeat(MAX_MESSAGE_LENGTH + 100));
    expect(result).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});

describe("validateMessages", () => {
  const validHistory = [
    { role: "user", text: "Hola" },
    { role: "model", text: "¡Eh, tú!" },
    { role: "user", text: "¿Cómo estás?" },
  ];

  it("acepta un historial válido que termina con un mensaje del usuario", () => {
    expect(validateMessages(validHistory)).toEqual({ valid: true, error: null });
  });

  it("rechaza lo que no es un arreglo o está vacío", () => {
    expect(validateMessages(undefined).valid).toBe(false);
    expect(validateMessages("hola").valid).toBe(false);
    expect(validateMessages([]).valid).toBe(false);
  });

  it("rechaza roles inválidos y textos vacíos", () => {
    expect(validateMessages([{ role: "system", text: "x" }]).valid).toBe(false);
    expect(validateMessages([{ role: "user", text: "   " }]).valid).toBe(false);
    expect(validateMessages([{ role: "user" }]).valid).toBe(false);
  });

  it("rechaza si el último mensaje no es del usuario", () => {
    const result = validateMessages([{ role: "model", text: "Hola" }]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/último mensaje/i);
  });

  it("rechaza mensajes demasiado largos", () => {
    const tooLong = [{ role: "user", text: "a".repeat(MAX_MESSAGE_LENGTH + 1) }];
    expect(validateMessages(tooLong).valid).toBe(false);
  });
});

describe("toGeminiContents", () => {
  it("convierte { role, text } al formato de Gemini { role, parts }", () => {
    const result = toGeminiContents([
      { role: "user", text: "Hola" },
      { role: "model", text: "¿Qué onda?" },
    ]);

    expect(result).toEqual([
      { role: "user", parts: [{ text: "Hola" }] },
      { role: "model", parts: [{ text: "¿Qué onda?" }] },
    ]);
  });
});

describe("extractReplyText", () => {
  it("extrae y limpia el texto de la primera respuesta", () => {
    const data = { candidates: [{ content: { parts: [{ text: "  Hola, " }, { text: "nene  " }] } }] };
    expect(extractReplyText(data)).toBe("Hola, nene");
  });

  it("devuelve cadena vacía si Gemini no mandó texto (respuesta bloqueada o rara)", () => {
    expect(extractReplyText({})).toBe("");
    expect(extractReplyText({ candidates: [] })).toBe("");
    expect(extractReplyText({ promptFeedback: { blockReason: "SAFETY" } })).toBe("");
    expect(extractReplyText(null)).toBe("");
  });
});
