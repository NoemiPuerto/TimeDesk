import { useEffect, useState } from "react";
import { checkForUpdate, type PendingUpdate } from "../lib/updater";

/** Versión que la persona decidió posponer. Se guarda para no volver a insistir. */
const DISMISSED_KEY = "timedesk-dismissed-update";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<PendingUpdate | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdate().then((pending) => {
      // Posponer vale solo para ESA versión: si sale una más nueva, vuelve a
      // avisar. Así el banner no puede quedar silenciado para siempre.
      if (pending && readDismissed() === pending.version) return;
      setUpdate(pending);
    });
  }, []);

  if (!update) return null;

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      await update!.install();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo instalar la actualización.");
      setInstalling(false);
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, update!.version);
    } catch {
      // Modo privado o storage bloqueado: al menos se cierra en esta sesión.
    }
    setUpdate(null);
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary-container text-on-primary text-xs py-1.5 px-4 flex items-center justify-center gap-3">
      <span>
        {/* Las dos versiones a la vista: sin esto era imposible saber si el
            aviso era correcto o un falso positivo. */}
        Nueva versión disponible: {update.currentVersion} → <strong>{update.version}</strong>
        {error && ` — ${error}`}
      </span>
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="underline font-bold disabled:opacity-60 shrink-0"
      >
        {installing ? "Instalando..." : "Actualizar y reiniciar"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={installing}
        aria-label="Posponer esta actualización"
        title="Posponer: no volver a avisar de esta versión"
        className="opacity-70 hover:opacity-100 disabled:opacity-40 shrink-0 px-1"
      >
        ✕
      </button>
    </div>
  );
}
