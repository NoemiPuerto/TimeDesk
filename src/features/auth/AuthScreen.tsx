import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

const INPUT_CLASS =
  "rounded-sm bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-surface-container rounded-lg p-8 flex flex-col gap-6">{children}</div>
    </div>
  );
}

function AuthHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/favicon.svg" alt="TimeDesk" className="w-14 h-14" />
      <h1 className="text-2xl font-bold tracking-tight">TimeDesk</h1>
      <p className="text-on-surface-variant text-sm text-center">{subtitle}</p>
    </div>
  );
}

function UpdatePasswordForm() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    // Al guardarla, el contexto sale del modo recuperación y la app se abre
    // con la sesión que dejó el código: no hace falta volver a iniciar sesión.
    if (result.error) setError(result.error);
  }

  return (
    <AuthShell>
      <AuthHeader subtitle="Elige una contraseña nueva" />
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña nueva
          <input
            type="password"
            minLength={6}
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirmar contraseña
          <input
            type="password"
            minLength={6}
            className={INPUT_CLASS}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-error text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-primary-container text-on-primary text-sm font-medium py-2 hover:bg-primary transition-colors disabled:opacity-50"
        >
          {submitting ? "Un momento..." : "Guardar contraseña"}
        </button>
      </form>
    </AuthShell>
  );
}

function ResetPasswordRequestForm({ onBack }: { onBack: () => void }) {
  const { requestPasswordReset, verifyRecoveryCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");

  async function handleSendEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else setStep("code");
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await verifyRecoveryCode(email, code);
    setSubmitting(false);
    // Si sale bien, el contexto marca passwordRecovery y AuthScreen cambia
    // solo a la pantalla de contraseña nueva.
    if (result.error) setError(result.error);
  }

  return (
    <AuthShell>
      <AuthHeader subtitle="Restablece tu contraseña" />
      {step === "email" ? (
        <form className="flex flex-col gap-4" onSubmit={handleSendEmail}>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              className={INPUT_CLASS}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          {error && <p className="text-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-primary-container text-on-primary text-sm font-medium py-2 hover:bg-primary transition-colors disabled:opacity-50"
          >
            {submitting ? "Un momento..." : "Enviar código"}
          </button>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleVerify}>
          <p className="text-sm text-on-surface-variant">
            Si existe una cuenta con <span className="text-on-surface">{email}</span>, te llegó un email. Escribe el
            código de 6 dígitos, o copia y pega aquí el enlace del email.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Código o enlace
            <input
              className={INPUT_CLASS}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </label>
          {error && <p className="text-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-primary-container text-on-primary text-sm font-medium py-2 hover:bg-primary transition-colors disabled:opacity-50"
          >
            {submitting ? "Comprobando..." : "Continuar"}
          </button>
          <button
            type="button"
            className="text-on-surface-variant text-xs underline self-center"
            onClick={() => {
              setError(null);
              setStep("email");
            }}
          >
            Volver a enviar el email
          </button>
        </form>
      )}
      <button type="button" className="text-on-surface-variant text-xs underline self-center" onClick={onBack}>
        Volver a iniciar sesión
      </button>
    </AuthShell>
  );
}

export function AuthScreen() {
  const { signInWithPassword, signUp, passwordRecovery } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (passwordRecovery) return <UpdatePasswordForm />;
  if (mode === "reset") return <ResetPasswordRequestForm onBack={() => setMode("signin")} />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const result =
      mode === "signin"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, displayName);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else if (mode === "signup") {
      // Con confirmación de email activada en Supabase, signUp no deja sesión:
      // sin este aviso la pantalla se queda igual y parece que no pasó nada.
      setNotice("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.");
    }
  }

  return (
    <AuthShell>
      <AuthHeader subtitle={mode === "signin" ? "Inicia sesión para continuar" : "Crea tu cuenta"} />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              className={INPUT_CLASS}
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
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-sm">
            Confirmar contraseña
            <input
              type="password"
              minLength={6}
              className={INPUT_CLASS}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        )}

        {mode === "signin" && (
          <button
            type="button"
            className="text-on-surface-variant text-xs underline self-end -mt-2"
            onClick={() => {
              setError(null);
              setMode("reset");
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {error && <p className="text-error text-sm">{error}</p>}
        {notice && <p className="text-on-surface text-sm">{notice}</p>}

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
          setNotice(null);
          setConfirmPassword("");
          setMode(mode === "signin" ? "signup" : "signin");
        }}
      >
        {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </AuthShell>
  );
}
