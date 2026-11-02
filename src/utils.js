// =========================================================
// utils.js — Funciones PURAS de transformación de datos
//
// "Pura" = recibe datos, devuelve datos, no toca el DOM ni la red.
// Por eso son las más fáciles de testear con Vitest (paso 9).
// =========================================================

// Debe coincidir con el maxlength del <input> en index.html
export const MAX_MESSAGE_LENGTH = 500;

/**
 * Crea un mensaje con la forma que usará todo el proyecto.
 * Usamos los roles de Gemini desde ya ("user" y "model") para no
 * tener que traducirlos cuando conectemos la API.
 *
 * @param {"user" | "model"} role  Quién habla
 * @param {string} text            Contenido del mensaje
 * @returns {{ role: string, text: string }}
 */
export function createMessage(role, text) {
  return { role, text };
}

/**
 * Limpia lo que escribió el usuario: quita espacios al inicio/final
 * y recorta si se pasa del largo máximo.
 * Si el resultado es "" significa que no hay nada que enviar.
 *
 * @param {unknown} raw  Valor crudo del input
 * @returns {string}
 */
export function cleanUserInput(raw) {
  return String(raw ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
}

// =========================================================
// Funciones para hablar con Gemini (se usan en la función serverless
// y también se pueden testear solas). Agregadas en el paso 5.
// =========================================================

const VALID_ROLES = ["user", "model"];
export const MAX_HISTORY_MESSAGES = 100; // tope de seguridad por petición

/**
 * Valida el historial que llega a la función serverless.
 * Nunca confiamos en lo que manda el navegador: cualquiera puede llamar
 * a /api/functions con curl y mandar cosas raras.
 *
 * @param {unknown} messages
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "Se necesita al menos un mensaje." };
  }
  if (messages.length > MAX_HISTORY_MESSAGES) {
    return { valid: false, error: "La conversación es demasiado larga." };
  }

  for (const message of messages) {
    const hasValidRole = message && VALID_ROLES.includes(message.role);
    const hasValidText = message && typeof message.text === "string" && message.text.trim() !== "";
    if (!hasValidRole || !hasValidText) {
      return { valid: false, error: "Formato de mensaje inválido." };
    }
    if (message.text.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: "Un mensaje supera el largo permitido." };
    }
  }

  // Gemini responde al último turno: tiene que ser del usuario
  if (messages[messages.length - 1].role !== "user") {
    return { valid: false, error: "El último mensaje debe ser del usuario." };
  }

  return { valid: true, error: null };
}

/**
 * Convierte nuestro historial [{ role, text }] al formato de Gemini:
 * [{ role, parts: [{ text }] }]
 */
export function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
}

/**
 * Saca el texto de la respuesta de Gemini.
 * La respuesta viene así: { candidates: [{ content: { parts: [{ text }] } }] }
 * Devuelve "" si no hay texto (por ejemplo, si Gemini bloqueó la respuesta).
 */
export function extractReplyText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}
