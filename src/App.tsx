import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AppLayout } from "./features/app/AppLayout";

function AppShell() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant text-sm">
        Cargando...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
