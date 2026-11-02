// =========================================================
// app.js — Router SPA con History API
//
// Idea general:
//   1. Cada vista (Home, Chat, About) es un <template> en index.html.
//   2. Al navegar, copiamos el template dentro de <main id="app">.
//   3. Cambiamos la URL con history.pushState (sin recargar la página).
//   4. El evento "popstate" hace que los botones atrás/adelante funcionen.
// =========================================================

import { initChat } from "./chat.js";

// Tabla de rutas: URL -> qué template pintar, qué título poner y (opcional)
// qué función ejecutar al entrar (onEnter).
// Si agregas una vista nueva, solo añades una línea aquí y su <template>.
const routes = {
  "/home": { template: "view-home", title: "Home" },
  "/chat": { template: "view-chat", title: "Chat", onEnter: initChat },
  "/about": { template: "view-about", title: "About" },
};

const DEFAULT_ROUTE = "/home";

/**
 * Convierte cualquier pathname en una ruta válida.
 * - "/" o rutas desconocidas -> "/home"
 * - "/chat/" (con diagonal final) -> "/chat"
 * Es una función pura (no toca el DOM), así que es fácil de testear.
 */
export function resolveRoute(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return routes[clean] ? clean : DEFAULT_ROUTE;
}

/** Pinta la vista de la ruta indicada dentro de <main id="app">. */
function render(path) {
  const route = routes[path];
  const app = document.getElementById("app");
  const template = document.getElementById(route.template);

  // cloneNode(true) copia el contenido del template; replaceChildren borra lo anterior
  app.replaceChildren(template.content.cloneNode(true));
  app.scrollTop = 0; // cada vista empieza arriba
  document.title = `${route.title} · Deadpool Chat`;

  updateActiveLink(path);

  // Si la vista tiene lógica propia (como el chat), la iniciamos ahora que su HTML ya existe
  if (route.onEnter) route.onEnter();
}

/** Marca con aria-current="page" el link de la vista activa (el CSS lo resalta). */
function updateActiveLink(path) {
  document.querySelectorAll("a[data-link]").forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

/** Navega a una ruta: cambia la URL SIN recargar y pinta la vista. */
export function navigate(path) {
  const target = resolveRoute(path);

  // Evita duplicar entradas en el historial si ya estás en esa ruta
  if (target !== window.location.pathname) {
    history.pushState({}, "", target);
  }
  render(target);
}

/** Arranque de la app: se ejecuta una sola vez al cargar la página. */
function init() {
  // 1) Interceptar clics en links con data-link (delegación de eventos:
  //    un solo listener sirve también para los links dentro de las vistas)
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-link]");
    if (!link) return;

    // Si el usuario hace Ctrl/Cmd+clic (abrir en pestaña nueva), dejamos el comportamiento normal
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    event.preventDefault(); // evita que el navegador recargue la página
    navigate(link.getAttribute("href"));
  });

  // 2) Botones atrás/adelante del navegador:
  //    la URL ya cambió sola, solo falta pintar la vista que le corresponde.
  window.addEventListener("popstate", () => {
    render(resolveRoute(window.location.pathname));
  });

  // 3) Render inicial según la URL con la que se abrió la página
  //    (por ejemplo, si alguien entra directo a /about)
  const initial = resolveRoute(window.location.pathname);
  if (initial !== window.location.pathname) {
    // replaceState (no push) para que el botón "atrás" no regrese a una URL inválida
    history.replaceState({}, "", initial);
  }
  render(initial);
}

// Solo arrancamos si estamos en un navegador (así los tests con Vitest
// pueden importar resolveRoute sin que explote por no existir "document").
if (typeof window !== "undefined" && typeof document !== "undefined") {
  init();
}
