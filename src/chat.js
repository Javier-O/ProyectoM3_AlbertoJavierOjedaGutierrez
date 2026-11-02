// =========================================================
// chat.js — Lógica específica del chat
//
// Separamos 3 responsabilidades (así lo pide el objetivo del PI):
//   1. ESTADO       -> variables del módulo (historial, cargando, error)
//   2. OBTENER DATOS -> requestReply()  (fetch a /api/functions)
//   3. RENDERIZADO  -> funciones build*/renderMessages (pintan en el DOM)
// =========================================================

import { createMessage, cleanUserInput } from "./utils.js";

// Saludo inicial. Se pinta siempre al principio, pero NO se guarda en el
// historial: Gemini espera que la conversación empiece con un mensaje del usuario.
const GREETING = "¡Eh, tú! Sí, tú, el que lee esto. ¿Vienes a hablar o a mirar?";

// ---------------------------------------------------------
// 1. ESTADO
// Vive a nivel de módulo, así que se conserva al cambiar de vista
// (Home -> Chat -> About -> Chat) y solo se pierde si recargas la página.
// Justo lo que pide la consigna: "historial solo durante la sesión".
// ---------------------------------------------------------
let messages = []; // historial: [{ role: "user" | "model", text }]
let isLoading = false; // true mientras esperamos la respuesta
let errorText = null; // texto de error a mostrar (o null)
let draft = ""; // texto que el usuario no pudo enviar (para devolverlo al input)

// ---------------------------------------------------------
// 2. OBTENER DATOS (llama a nuestra función serverless, nunca a Gemini directo)
// ---------------------------------------------------------
const API_URL = "/api/functions";
const REQUEST_TIMEOUT_MS = 30000; // si en 30 s no hay respuesta, damos por fallida la petición

/**
 * Envía el historial COMPLETO a la función serverless y devuelve el texto
 * de la respuesta. Gemini no recuerda nada entre peticiones, por eso mandamos
 * todos los mensajes cada vez.
 *
 * Lanza un Error con un mensaje listo para mostrar al usuario si algo falla.
 */
export async function requestReply(history) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Intentamos leer el JSON; si la respuesta no lo trae, seguimos con data = null
  let data = null;
  try {
    data = await response.json();
  } catch {
    // respuesta sin JSON: se maneja abajo
  }

  // La función serverless manda { error: "mensaje amigable" } cuando algo falla
  if (!response.ok) {
    throw new Error(data?.error || "Algo salió mal al contactar a Deadpool.");
  }
  if (!data?.reply) {
    throw new Error("Deadpool respondió vacío. Inténtalo de nuevo.");
  }

  return data.reply;
}

// ---------------------------------------------------------
// 3. RENDERIZADO
// Usamos textContent (nunca innerHTML) para el texto de los mensajes:
// así, si alguien escribe "<script>", se muestra como texto y no se ejecuta.
// ---------------------------------------------------------

/** Burbuja de mensaje. role: "user" (derecha, negra) o "model" (izquierda, blanca). */
function buildBubble(role, text) {
  const item = document.createElement("li");
  item.className = role === "user" ? "message message--user" : "message message--character";

  if (role !== "user") {
    const author = document.createElement("span");
    author.className = "message__author";
    author.textContent = "Deadpool";
    item.append(author);
  }

  const paragraph = document.createElement("p");
  paragraph.className = "message__text";
  paragraph.textContent = text;
  item.append(paragraph);

  return item;
}

/** Burbuja de "escribiendo..." con tres puntos animados (el CSS ya existe). */
function buildTyping() {
  const item = document.createElement("li");
  item.className = "message message--character message--typing";
  item.setAttribute("aria-label", "Deadpool está escribiendo");

  const author = document.createElement("span");
  author.className = "message__author";
  author.textContent = "Deadpool";

  const dots = document.createElement("p");
  dots.className = "message__text typing";
  dots.append(
    document.createElement("span"),
    document.createElement("span"),
    document.createElement("span")
  );

  item.append(author, dots);
  return item;
}

/** Caja amarilla de error. */
function buildError(text) {
  const item = document.createElement("li");
  item.className = "message message--error";
  item.setAttribute("role", "alert");

  const paragraph = document.createElement("p");
  paragraph.className = "message__text";
  paragraph.textContent = text;
  item.append(paragraph);

  return item;
}

/** Vuelve a pintar toda la lista según el estado actual y baja el scroll al final. */
function renderMessages() {
  const list = document.getElementById("messages");
  if (!list) return; // el usuario está en otra vista: no hay nada que pintar

  const items = [
    buildBubble("model", GREETING),
    ...messages.map((message) => buildBubble(message.role, message.text)),
  ];
  if (isLoading) items.push(buildTyping());
  if (errorText) items.push(buildError(errorText));

  list.replaceChildren(...items);
  list.scrollTop = list.scrollHeight; // scroll automático al último mensaje

  // El botón se desactiva mientras esperamos, para no enviar dos mensajes a la vez
  const sendButton = document.querySelector(".chat__send");
  if (sendButton) sendButton.disabled = isLoading;
}

/** Convierte cualquier error en un mensaje claro para el usuario. */
function describeError(error) {
  if (error.name === "TimeoutError") {
    return "Deadpool tardó demasiado en responder. Inténtalo de nuevo.";
  }
  if (error instanceof TypeError) {
    // fetch lanza TypeError cuando no hay red o el servidor no responde
    return "No pude conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  return error.message; // mensaje amigable que vino de la función serverless
}

// ---------------------------------------------------------
// FLUJO PRINCIPAL: qué pasa cuando el usuario envía un mensaje
// ---------------------------------------------------------
async function handleSubmit(event) {
  event.preventDefault(); // evita que el <form> recargue la página

  const input = document.getElementById("chat-input");
  const text = cleanUserInput(input.value);
  if (isLoading || !text) return;

  // 1) Agregamos el mensaje del usuario y mostramos "escribiendo..."
  messages.push(createMessage("user", text));
  input.value = "";
  draft = "";
  errorText = null;
  isLoading = true;
  renderMessages();

  // 2) Pedimos la respuesta. try/catch/finally cubre éxito y fallo.
  try {
    const reply = await requestReply(messages);
    messages.push(createMessage("model", reply));
  } catch (error) {
    // Quitamos el mensaje que no tuvo respuesta y lo devolvemos al input,
    // así el usuario puede reintentar sin reescribir y el historial queda ordenado.
    messages.pop();
    draft = text;
    errorText = describeError(error);
    const currentInput = document.getElementById("chat-input");
    if (currentInput) currentInput.value = draft;
  } finally {
    isLoading = false;
    renderMessages();
  }
}

/**
 * Se llama cada vez que el router pinta la vista /chat.
 * Como el template se clona de nuevo, hay que reconectar el formulario
 * y volver a pintar el historial que ya teníamos en memoria.
 */
export function initChat() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  input.value = draft;
  form.addEventListener("submit", handleSubmit);
  renderMessages();
}
