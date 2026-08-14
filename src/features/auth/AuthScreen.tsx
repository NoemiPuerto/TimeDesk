import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function AuthScreen() {
  const { signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result =
      mode === "signin"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, displayName);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-surface-container rounded-lg p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-md bg-primary-container flex items-center justify-center text-on-primary font-bold text-lg">
            TD
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TimeDesk</h1>
          <p className="text-on-surface-variant text-sm text-center">
            {mode === "signin" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                className="rounded-sm bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              className="rounded-sm bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Contraseña
            <input
              type="password"
              minLength={6}
              className="rounded-sm bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="text-error text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-primary-container text-on-primary text-sm font-medium py-2 hover:bg-primary transition-colors disabled:opacity-50"
          >
            {submitting ? "Un momento..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          className="text-on-surface-variant text-xs underline self-center"
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
