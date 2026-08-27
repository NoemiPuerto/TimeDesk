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

export async function getActiveSession(): Promise<TimeSession | null> {
  const { data, error } = await supabase.from("time_sessions").select("*").is("ended_at", null).maybeSingle();
  if (error) throw error;
  return data;
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
 * Cierra la sesión abierta si dejó de latir (app cerrada, equipo suspendido o
 * apagado), usando el último latido como hora de fin. Devuelve la sesión que
 * cerró, o null si no había nada colgado.
 */
export async function closeStaleTimer(staleSeconds: number): Promise<TimeSession | null> {
  const { data, error } = await supabase.rpc("close_stale_timer", { p_stale_seconds: staleSeconds });
  if (error) throw error;
  return data as TimeSession | null;
}

/**
 * Detiene la sesión abierta del usuario sin necesitar su id — hace falta al
 * cerrar la app, donde puede no haber ningún componente con la sesión cargada.
 * El UPDATE no filtra por user_id porque la política RLS
 * "users can update their own time sessions" ya lo acota a las suyas.
 */
export async function stopActiveTimer(): Promise<void> {
  const { error } = await supabase
    .from("time_sessions")
    .update({ ended_at: new Date().toISOString() })
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
