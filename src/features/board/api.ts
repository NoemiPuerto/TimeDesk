import { supabase } from "../../lib/supabase";

export type Column = {
  id: string;
  board_id: string;
  project_id: string;
  name: string;
  position: number;
};

export type Priority = "low" | "medium" | "high";

export type Task = {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: Priority | null;
  /** Cuándo arranca la tarea. La fija la creación y se puede mover; nunca es null. */
  start_date: string;
  due_date: string | null;
  position: number;
  created_at: string;
  /** Momento en que pasó a la última columna. Lo mantiene un trigger. */
  completed_at: string | null;
};

export type TaskDetails = {
  description: string | null;
  priority: Priority | null;
  start_date: string;
  due_date: string | null;
};

/** Columnas que componen un `Task`. Compartida para que ninguna consulta se quede corta. */
export const TASK_COLUMNS =
  "id, project_id, column_id, title, description, priority, start_date, due_date, position, created_at, completed_at";

export async function listColumns(projectId: string): Promise<Column[]> {
  const { data, error } = await supabase
    .from("columns")
    .select("id, board_id, project_id, name, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createColumn(projectId: string, name: string): Promise<Column> {
  // See rpc_writes migration: INSERT on FK-bearing tables must go through an
  // RPC on this Postgres instance.
  const { data, error } = await supabase.rpc("create_column", { p_project_id: projectId, p_name: name });
  if (error) throw error;
  return data;
}

export async function renameColumn(columnId: string, name: string): Promise<void> {
  const { error } = await supabase.from("columns").update({ name }).eq("id", columnId);
  if (error) throw error;
}

export async function deleteColumn(columnId: string): Promise<void> {
  const { error } = await supabase.from("columns").delete().eq("id", columnId);
  if (error) throw error;
}

export async function reorderColumns(updates: { id: string; position: number }[]): Promise<void> {
  const results = await Promise.all(
    updates.map((u) => supabase.from("columns").update({ position: u.position }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function listTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Task[];
}

/**
 * Las tareas que el tablero del Timer debe mostrar, filtradas EN LA CONSULTA.
 *
 * Reglas, todas resueltas por Postgres y no por el render:
 *  - sin fecha límite  -> siempre visibles (son trabajo pendiente igual)
 *  - vencidas          -> visibles (entran por `due_date <= endKey`)
 *  - dentro de la ventana hoy..hoy+6 -> visibles
 *  - posteriores a la ventana        -> fuera
 *  - terminadas        -> solo las cerradas dentro de la ventana; como
 *    `completed_at` nunca puede estar en el futuro, en la práctica son las de
 *    hoy. Las terminadas no heredan la exención de "sin fecha": esa exención
 *    existe para no perder de vista trabajo pendiente, y una tarea acabada no
 *    lo es.
 *
 * Los dos `.or()` encadenados se combinan con AND en PostgREST.
 */
export async function listTimerTasks(
  projectId: string,
  endKey: string,
  todayStartIso: string,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("project_id", projectId)
    .or(`due_date.is.null,due_date.lte.${endKey}`)
    .or(`completed_at.is.null,completed_at.gte.${todayStartIso}`)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function createTask(
  projectId: string,
  columnId: string,
  title: string,
  startDate: string,
): Promise<Task> {
  // See rpc_writes migration: INSERT on FK-bearing tables must go through an
  // RPC on this Postgres instance.
  // `startDate` va explícito porque el cliente es quien sabe la fecha LOCAL:
  // el `current_date` de la función es UTC y adelantaría un día a quien cree
  // una tarea por la tarde en un huso negativo.
  const { data, error } = await supabase.rpc("create_task", {
    p_project_id: projectId,
    p_column_id: columnId,
    p_title: title,
    p_start_date: startDate,
  });
  if (error) throw error;
  return data as Task;
}

export async function renameTask(taskId: string, title: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ title }).eq("id", taskId);
  if (error) throw error;
}

export async function updateTaskDetails(taskId: string, details: Partial<TaskDetails>): Promise<void> {
  const { error } = await supabase.from("tasks").update(details).eq("id", taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

/**
 * Cambia una tarea de columna sin tocar `position`.
 *
 * Lo usa el tablero del Timer, que trabaja con una lista recortada por fechas:
 * renumerar la columna entera desde ahí calcularía las posiciones contra una
 * lista incompleta, que es el mismo fallo por el que ya se desactiva el
 * arrastre cuando hay filtros activos.
 */
export async function moveTaskToColumn(taskId: string, columnId: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ column_id: columnId }).eq("id", taskId);
  if (error) throw error;
}

export async function reorderTasks(updates: { id: string; column_id: string; position: number }[]): Promise<void> {
  const results = await Promise.all(
    updates.map((u) => supabase.from("tasks").update({ column_id: u.column_id, position: u.position }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
