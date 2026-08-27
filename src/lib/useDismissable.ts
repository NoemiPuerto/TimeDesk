import { useEffect, useRef } from "react";

/**
 * Cierra un panel flotante (dropdown, popover) al hacer click fuera de él o al
 * pulsar Escape. Devuelve el ref que hay que poner en el contenedor que
 * envuelve TANTO al disparador como al panel — si el disparador queda fuera,
 * el propio click que abre el panel cuenta como "click fuera" y lo cierra al
 * instante.
 *
 * Se cierra con `mousedown` y no con `mouseleave` a propósito: varios de estos
 * paneles tienen formularios dentro (invitar por email, crear proyecto) y
 * cerrarlos al salir el cursor perdería lo que la persona estaba escribiendo.
 */
export function useDismissable<T extends HTMLElement = HTMLDivElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  // Evita re-suscribir los listeners en cada render por una prop nueva.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismissRef.current();
    }
    // La ventana pierde el foco (alt-tab, se minimiza la app): dejar un panel
    // abierto flotando sobre la interfaz al volver no aporta nada.
    function handleWindowBlur() {
      onDismissRef.current();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [open]);

  return ref;
}
