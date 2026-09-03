import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
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
  /** Motivo por el que falló un enlace de recuperación, si falló. */
  recoveryError: string | null;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

/**
 * Recuperación de contraseña por enlace, con deep link.
 *
 * El enlace del email va a Supabase, que valida el token y redirige a
 * `timedesk://reset-password#access_token=…`. Ese esquema lo registra la app
 * (ver `tauri.conf.json` y `tauri-plugin-deep-link`), así que el sistema
 * devuelve el control a TimeDesk y la ventana aparece en la pantalla de
 * contraseña nueva. Sin el esquema propio no hay forma de que un navegador
 * "vuelva" a una app de escritorio sin dominio web.
 *
 * Supabase manda el resultado de dos formas según la versión del enlace: la
 * sesión ya montada en el fragmento (`#access_token`), o un `token_hash` en la
 * query que hay que canjear. Se contemplan las dos.
 */
/** A donde Supabase devuelve el control tras validar el enlace del email. */
export const RECOVERY_REDIRECT = "timedesk://reset-password";

type RecoveryPayload =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "hash"; tokenHash: string }
  | { kind: "error"; message: string }
  | null;

function parseRecoveryUrl(input: string): RecoveryPayload {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;

  // Supabase avisa de los fallos por aquí (enlace caducado, ya usado). Sin
  // mirarlo, la app se quedaría esperando en silencio.
  const errorText = fragment.get("error_description") ?? query.get("error_description");
  if (errorText) return { kind: "error", message: errorText.replace(/\+/g, " ") };

  // Enlace ya redirigido: la sesión viene montada en el fragmento.
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken };

  // Enlace sin redirigir todavía: hay que canjear el hash.
  const tokenHash = fragment.get("token_hash") ?? query.get("token_hash") ?? query.get("token");
  return tokenHash ? { kind: "hash", tokenHash } : null;
}

/**
 * Traduce los errores de Supabase a algo que se pueda accionar.
 *
 * Los suyos vienen en inglés y describen el mecanismo ("Token has expired or is
 * invalid"), no qué hacer. Se conserva el original cuando no se reconoce, para
 * no esconder un fallo distinto detrás de un texto genérico.
 */
function recoveryErrorMessage(raw: string): string {
  const message = raw.toLowerCase();
  if (message.includes("expired") || message.includes("invalid")) {
    return "El código no es válido o ya caducó. Pide uno nuevo.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }
  return raw;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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

  /**
   * Enlace de recuperación abierto desde el email.
   *
   * `onOpenUrl` se dispara tanto si la app estaba cerrada (el sistema la
   * arranca con la URL) como si ya estaba abierta —ahí la URL llega vía
   * single-instance, que la reenvía a la ventana viva en vez de abrir otra—.
   *
   * Se registra en su propio efecto y no dentro del de la sesión para que un
   * fallo al pedir la API de deep link (permiso ausente, plugin no cargado) no
   * se lleve por delante la carga de la sesión, que es lo que abre la app.
   */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function handleUrl(url: string) {
      const payload = parseRecoveryUrl(url);
      if (!payload) return;

      if (payload.kind === "error") {
        setRecoveryError(recoveryErrorMessage(payload.message));
        return;
      }

      const { error } =
        payload.kind === "session"
          ? await supabase.auth.setSession({
              access_token: payload.accessToken,
              refresh_token: payload.refreshToken,
            })
          : await supabase.auth.verifyOtp({ token_hash: payload.tokenHash, type: "recovery" });

      if (error) {
        setRecoveryError(recoveryErrorMessage(error.message));
        return;
      }
      // Canjear el enlace ya deja una sesión válida, así que sin esta marca la
      // app se abriría directamente y la pantalla de contraseña nueva no
      // llegaría a verse nunca.
      setRecoveryError(null);
      setPasswordRecovery(true);
    }

    onOpenUrl((urls) => {
      for (const url of urls) void handleUrl(url);
    })
      .then((off) => {
        if (cancelled) off();
        else unlisten = off;
      })
      .catch(() => {
        // Fuera del shell de Tauri (el dev server en el navegador) no hay deep
        // links. No es un fallo: solo no se puede recuperar por enlace ahí.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
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
    // Sin `redirectTo`, Supabase manda al Site URL del proyecto —que aquí no
    // lleva a ninguna parte— y el token se consume por el camino.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_REDIRECT,
    });
    return { error: error?.message ?? null };
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
        recoveryError,
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
