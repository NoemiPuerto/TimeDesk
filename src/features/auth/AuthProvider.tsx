import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  verifyRecoveryCode: (email: string, codeOrLink: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

/**
 * TimeDesk es una app de escritorio sin dominio web propio ni deep-link, así
 * que el enlace del email de recuperación no puede "volver" a la ventana de la
 * app. En vez de eso, la persona trae el token a mano: o el código de 6 dígitos
 * ({{ .Token }} en la plantilla de email de Supabase) o el enlace completo
 * copiado del email, del que sacamos el token acá.
 */
function extractRecoveryToken(input: string): { token?: string; tokenHash?: string; accessToken?: string; refreshToken?: string } {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return { token: trimmed };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { token: trimmed };
  }

  // El enlace ya redirigido trae la sesión en el fragmento (#access_token=...).
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { accessToken, refreshToken };

  // El enlace tal cual viene del email: /auth/v1/verify?token=<hash>&type=recovery
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token") ?? undefined;
  return { tokenHash };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Fires when the user opens the link from a password-reset email —
      // Supabase establishes a temporary session for updateUser() to run in.
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  }

  async function verifyRecoveryCode(email: string, codeOrLink: string) {
    const parsed = extractRecoveryToken(codeOrLink);

    if (parsed.accessToken && parsed.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) return { error: error.message };
      setPasswordRecovery(true);
      return { error: null };
    }

    const { error } = parsed.tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: parsed.tokenHash, type: "recovery" })
      : await supabase.auth.verifyOtp({ email, token: parsed.token ?? "", type: "recovery" });

    if (error) return { error: error.message };
    // verifyOtp emite SIGNED_IN, no PASSWORD_RECOVERY: lo marcamos a mano para
    // que la pantalla siguiente sea "elige una contraseña nueva" y no la app.
    setPasswordRecovery(true);
    return { error: null };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return { error: error?.message ?? null };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        passwordRecovery,
        signInWithPassword,
        signUp,
        signOut,
        requestPasswordReset,
        verifyRecoveryCode,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
