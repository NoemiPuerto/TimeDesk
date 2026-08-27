import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AppLayout } from "./features/app/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ToastContainer";

function AppShell() {
  const { session, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant text-sm">
        Cargando...
      </div>
    );
  }

  // Verificar el código de recuperación ya deja una sesión válida: sin mirar
  // también `passwordRecovery`, la app se abriría directamente y el formulario
  // de "contraseña nueva" no llegaría a mostrarse nunca.
  if (!session || passwordRecovery) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell />
          <ToastContainer />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
