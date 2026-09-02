import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Qué pintar si esta rama revienta. Sin esto se muestra la pantalla completa
   * de "algo salió mal", que solo tiene sentido en la raíz de la app: para una
   * sección concreta (el timer, por ejemplo) el resto de la aplicación debe
   * seguir siendo usable.
   */
  fallback?: (retry: () => void) => ReactNode;
  /** Aparece en el console.error para saber qué rama falló. */
  label?: string;
};
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(`Unhandled error${this.props.label ? ` in ${this.props.label}` : ""}:`, error, info);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.retry);

      return (
        <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold">Algo salió mal</h1>
          <p className="text-on-surface-variant text-sm max-w-sm">
            Ocurrió un error inesperado. Intenta recargar la aplicación.
          </p>
          <button
            type="button"
            className="px-6 py-2 rounded-full bg-primary-container text-on-primary text-sm font-medium hover:bg-primary transition-colors"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Aviso compacto para una sección que falló, sin tapar el resto de la app. */
export function SectionErrorFallback({ title, retry }: { title: string; retry: () => void }) {
  return (
    <div className="bg-surface-container rounded-lg p-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          El resto de la aplicación sigue funcionando con normalidad.
        </p>
      </div>
      <button
        type="button"
        onClick={retry}
        className="self-start sm:self-auto shrink-0 text-sm text-primary px-4 py-2 rounded-md border border-primary/40 hover:bg-primary/10 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
