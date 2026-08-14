import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { AuthScreen } from "./features/auth/AuthScreen";

function AppShell() {
  const { session, loading, signOut } = useAuth();

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

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-on-surface-variant">Sesión iniciada como {session.user.email}</p>
      <button
        type="button"
        className="px-6 py-2 rounded-full bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-container-highest transition-colors"
        onClick={signOut}
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
