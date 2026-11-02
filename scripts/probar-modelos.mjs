// =========================================================
// scripts/probar-modelos.mjs — Herramienta de diagnóstico (no es parte de la app)
//
// Prueba varios modelos de Gemini AL MISMO TIEMPO y muestra para cada uno:
// estado HTTP, cuánto tardó y un fragmento de la respuesta o del error.
// Sirve para elegir un modelo que realmente responda desde tu equipo.
//
// Uso (desde la raíz del proyecto):
//   node --env-file=.env scripts/probar-modelos.mjs
//   node --env-file=.env scripts/probar-modelos.mjs gemini-3.5-flash otro-modelo
// =========================================================

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Falta GEMINI_API_KEY. Ejecuta con: node --env-file=.env scripts/probar-modelos.mjs");
  process.exit(1);
}

// Modelos a probar (se pueden pasar otros como argumentos)
const DEFAULT_MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];
const models = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_MODELS;

const TIMEOUT_MS = 20000;

async function probe(model) {
  const startedAt = Date.now();
  const elapsed = () => `${Date.now() - startedAt} ms`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Responde solo: hola" }] }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    const data = await response.json().catch(() => null);

    if (response.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return `OK     ${model.padEnd(26)} ${response.status}  ${elapsed().padStart(8)}  "${text.trim().slice(0, 50)}"`;
    }

    const message = (data?.error?.message ?? "sin detalle").replace(/\s+/g, " ").slice(0, 140);
    return `FALLÓ  ${model.padEnd(26)} ${response.status}  ${elapsed().padStart(8)}  ${message}`;
  } catch (error) {
    return `FALLÓ  ${model.padEnd(26)} ${error.name}  ${elapsed().padStart(8)}`;
  }
}

console.log(`Probando ${models.length} modelos (máximo ${TIMEOUT_MS / 1000} s cada uno)...\n`);

// Cada resultado se imprime apenas llega, sin esperar a los demás
await Promise.all(models.map(async (model) => console.log(await probe(model))));
