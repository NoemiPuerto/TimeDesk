import { supabase } from "../../lib/supabase";

export type TimeSession = {
  id: string;
  project_id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  /** Última señal de vida de la app mientras el timer corría. */
  last_heartbeat_at: string;
};

/** Id del usuario actual, leído del storage local (no hace red, a diferencia de getUser). */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * La sesión de timer abierta DEL USUARIO ACTUAL.
 *
 * El filtro por `user_id` es imprescindible y antes no estaba: la consulta se
 * apoyaba solo en RLS, pero la política SELECT de `time_sessions` también
 * entrega sesiones ajenas (proyecto personal compartido, o proyecto de equipo
 * si eres admin). Con un compañero cronometrando a la vez, la consulta devolvía
 * dos filas y `.maybeSingle()` reventaba con PGRST116 — el timer se quedaba
 * muerto sin decir por qué. Además se pide `limit(1)`, así que ya no puede
 * fallar por multiplicidad ni aunque el índice único desapareciera.
 */
export async function getActiveSession(): Promise<TimeSession | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0] ?? null;
}

export async function startTimer(taskId: string): Promise<TimeSession> {
  // INSERT on time_sessions goes through an RPC — see start_task_timer
  // migration and the note in CLAUDE.md about FK-bearing table inserts.
  const { data, error } = await supabase.rpc("start_task_timer", { p_task_id: taskId });
  if (error) throw error;
  return data;
}

export async function stopTimer(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("time_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

/** Marca que la app sigue viva. Solo afecta a la sesión abierta del usuario. */
export async function sendHeartbeat(): Promise<void> {
  const { error } = await supabase.rpc("heartbeat_timer");
  if (error) throw error;
}

/**
 * Una fila de RPC solo cuenta como sesión si trae los campos que la definen.
 *
 * Cuando una función que devuelve un tipo compuesto no encuentra nada, PostgREST
 * responde con la fila entera a `null` campo por campo (`{id: null, started_at:
 * null, ...}`) en vez de un `null` pelado. Ese objeto es *truthy*, así que
 * atravesaba el `if (!closed)` y llegaba a la interfaz como si fuera una sesión
 * real. Como `new Date(null).getTime()` es 0 —el epoch, no NaN—, el aviso
 * anunciaba "496705:41:57": los años transcurridos desde 1970. Y como nunca
 * había nada que cerrar, saltaba en cada arranque.
 */
function asSession(row: unknown): TimeSession | null {
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<TimeSession>;
  if (!candidate.id || !candidate.started_at) return null;
  return candidate as TimeSession;
}

/**
 * Cierra la sesión abierta si dejó de latir (app cerrada, equipo suspendido o
 * apagado), usando el último latido como hora de fin. Devuelve la sesión que
 * cerró, o null si no había nada colgado.
 */
export async function closeStaleTimer(staleSeconds: number): Promise<TimeSession | null> {
  const { data, error } = await supabase.rpc("close_stale_timer", { p_stale_seconds: staleSeconds });
  if (error) throw error;
  return asSession(data);
}

/**
 * Detiene la sesión abierta del usuario. Hace falta al cerrar la app, donde
 * puede no haber ningún componente con la sesión cargada. Filtra por `user_id`
 * de forma explícita: la política RLS ya lo acota, pero dejarlo implícito es lo
 * que hizo que `getActiveSession` tocara filas ajenas sin que se notara.
 */
export async function stopActiveTimer(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("time_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null);
  if (error) throw error;
}

export async function listTaskSessions(taskId: string): Promise<TimeSession[]> {
  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .eq("task_id", taskId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listProjectSessions(projectId: string): Promise<TimeSession[]> {
  const { data, error } = await supabase.from("time_sessions").select("*").eq("project_id", projectId);
  if (error) throw error;
  return data;
}
