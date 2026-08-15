import { useEffect, useState } from "react";
import { checkForUpdate, type PendingUpdate } from "../lib/updater";

export function UpdateBanner() {
  const [update, setUpdate] = useState<PendingUpdate | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdate().then(setUpdate);
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary-container text-on-primary text-xs text-center py-1.5 flex items-center justify-center gap-3">
      <span>
        Nueva versión disponible ({update.version}){error && ` — ${error}`}
      </span>
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="underline font-bold disabled:opacity-60"
      >
        {installing ? "Instalando..." : "Actualizar y reiniciar"}
      </button>
    </div>
  );
}
