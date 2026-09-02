import React from "react";
import ReactDOM from "react-dom/client";
import type { Root } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;

/**
 * La raíz se guarda en `window` en vez de en una variable del módulo.
 *
 * En desarrollo, Vite puede volver a ejecutar este módulo en un hot-update. Si
 * eso pasa, `createRoot` se llamaría por segunda vez sobre el MISMO nodo y
 * React montaría una copia entera de la aplicación dentro del contenedor, sin
 * desmontar la anterior: dos árboles vivos a la vez, cada uno recordando el
 * proyecto que tenía seleccionado. Las barras laterales quedan superpuestas
 * (son `fixed`) y los contenidos se apilan uno debajo de otro.
 *
 * En producción el módulo se ejecuta una sola vez, así que esto no cambia nada.
 */
declare global {
  interface Window {
    __timedeskRoot?: Root;
  }
}

const root = window.__timedeskRoot ?? ReactDOM.createRoot(container);
window.__timedeskRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
