import { supabase } from "../../lib/supabase";

export type TimeSession = {
  id: string;
  project_id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
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
