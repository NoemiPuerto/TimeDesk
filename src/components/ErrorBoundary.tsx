import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Unhandled error:", error, info);
  }

  render() {
    if (this.state.hasError) {
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
