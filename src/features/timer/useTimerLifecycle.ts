import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "../../store/useToastStore";
import * as api from "./api";
import { formatDuration, sessionSeconds } from "./utils";

/** Cada cuánto la app avisa que sigue viva. */
const HEARTBEAT_MS = 30_000;
/**
 * A partir de cuánto silencio damos por muerta la sesión. Tiene que ser
 * bastante mayor que HEARTBEAT_MS para tolerar un latido perdido por una caída
 * breve de red sin cortar un timer que en realidad sigue corriendo.
 */
const STALE_SECONDS = 120;

/**
 * Mantiene honesto el tiempo registrado.
 *
 * El timer vive en la base como (started_at, ended_at is null), así que sin
 * esto una sesión abierta seguía sumando horas aunque la app estuviera cerrada,
 * el equipo suspendido o apagado. Acá la app late mientras el timer corre y, si
 * detecta que estuvo callada (arranque, vuelta de suspensión, ventana oculta),
 * le pide al servidor cerrar la sesión colgada en el último latido conocido.
 */
export function useTimerLifecycle({
  enabled,
  hasActiveSession,
}: {
  enabled: boolean;
  hasActiveSession: boolean;
}) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  // Reloj de pared del último tick: si el salto entre dos ticks es mucho mayor
  // que el intervalo, el equipo estuvo dormido.
  const lastTickRef = useRef(Date.now());
  const checkingRef = useRef(false);

  const closeIfStale = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const closed = await api.closeStaleTimer(STALE_SECONDS);
      if (!closed) return;

      const worked = formatDuration(sessionSeconds(closed, Date.now()));
      // Informativo, no un error: es el comportamiento correcto y esperado.
      // Redactado antes como "la app dejó de responder", que se lee como un
      // fallo de la aplicación cuando en realidad es la red de seguridad
      // haciendo su trabajo.
      pushToast(`Se cerró un timer que quedó abierto. Quedaron registradas ${worked} hasta la última señal.`);
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      queryClient.invalidateQueries({ queryKey: ["task-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["project-sessions"] });
    } catch {
      // Sin conexión: se reintenta en el próximo tick o al volver el foco.
    } finally {
      checkingRef.current = false;
    }
  }, [pushToast, queryClient]);

  // Al abrir la app: cerrar lo que haya quedado colgado de la sesión anterior
  // (se apagó el equipo, se mató el proceso, se fue la luz).
  useEffect(() => {
    if (!enabled) return;
    void closeIfStale();
  }, [enabled, closeIfStale]);

  // Latido mientras el timer corre. Sin sesión abierta no hay nada que latir.
  useEffect(() => {
    if (!enabled || !hasActiveSession) return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTickRef.current;
      lastTickRef.current = now;

      // El intervalo no corrió cuando debía: el equipo estuvo suspendido. No
      // late (eso taparía la evidencia); deja que el servidor decida.
      if (gap > STALE_SECONDS * 1000) void closeIfStale();
      else void api.sendHeartbeat().catch(() => {});
    }, HEARTBEAT_MS);

    function handleWake() {
      if (Date.now() - lastTickRef.current > STALE_SECONDS * 1000) {
        lastTickRef.current = Date.now();
        void closeIfStale();
      }
    }

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
    };
  }, [enabled, hasActiveSession, closeIfStale]);

  // Cierre de la ventana: parar el timer ahí mismo, en vez de dejar que lo
  // cierre el latido caducado la próxima vez que se abra la app.
  useEffect(() => {
    if (!enabled) return;
    if (!("__TAURI_INTERNALS__" in window)) return;

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        const stop = await appWindow.onCloseRequested(async (event) => {
          event.preventDefault();
          try {
            await api.stopActiveTimer();
          } catch {
            // Si no se pudo guardar (sin red), el latido caducado lo cerrará
            // igual la próxima vez que se abra la app.
          }
          // destroy() va fuera del try de arriba a propósito: si fallara, la
          // ventana se quedaría sin cerrar y la app parecería colgada.
          try {
            await appWindow.destroy();
          } catch {
            window.close();
          }
        });
        if (disposed) stop();
        else unlisten = stop;
      } catch (err) {
        // Registrar el handler puede fallar (permiso de capabilities ausente,
        // API de ventana no disponible). Sin este catch quedaba una promesa
        // rechazada sin manejar en pleno arranque. El timer pierde el cierre
        // limpio, no la app: el latido caducado sigue siendo la red de
        // seguridad.
        console.warn("No se pudo registrar el cierre limpio del timer:", err);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);
}
