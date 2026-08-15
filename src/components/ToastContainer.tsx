import { useToastStore } from "../store/useToastStore";

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-surface-container-highest border border-error/30 text-on-surface rounded-md px-4 py-3 shadow-lg flex items-start justify-between gap-3"
        >
          <p className="text-sm">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-on-surface-variant text-xs shrink-0"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
