import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ClockIcon } from "../../components/icons";
import { useAppStore } from "../../store/useAppStore";
import { summarize, totalHours } from "../analytics/utils";
import { useColumns, useTasks } from "../board/hooks";
import { useActiveSession, useProjectSessions, useStartTimer, useStopTimer, useTaskSessions } from "./hooks";
import { formatDuration, sessionSeconds, totalSeconds } from "./utils";

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-container rounded-lg p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
        <span className="text-on-surface-variant">{icon}</span>
      </div>
      <span className="text-2xl font-bold text-on-surface">{value}</span>
      {hint && <span className="text-xs text-on-surface-variant">{hint}</span>}
    </div>
  );
}

export function TimerSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { focusedTaskId, setFocusedTaskId } = useAppStore();
  const { data: activeSession, isSuccess: activeSessionLoaded } = useActiveSession();
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);
  const { data: taskSessions } = useTaskSessions(focusedTaskId);
  const { data: projectSessions } = useProjectSessions(projectId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const [now, setNow] = useState(() => Date.now());

  const isRunningHere = !!activeSession && activeSession.task_id === focusedTaskId;
  // Un timer corriendo en OTRO proyecto: sin avisarlo, el timer de acá se ve
  // en 00:00:00 y parece que no se registró nada.
  const runningElsewhere = !!activeSession && activeSession.project_id !== projectId;

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Recupera un timer que ya venía corriendo (recarga, o volver a este
  // proyecto). Corre una sola vez, cuando la sesión activa Y las tareas de
  // ESTE proyecto ya resolvieron: no puede re-ejecutarse en cada cambio o
  // pelearía con el setFocusedTaskId(null) de handleStop (el activeSession
  // cacheado sigue no-nulo justo después de disparar la mutación de stop).
  //
  // `focusedTaskId` es global, así que al cambiar de proyecto puede venir
  // apuntando a una tarea del anterior; si no es de acá, se limpia.
  const hasSyncedOnLoad = useRef(false);
  useEffect(() => {
    if (!activeSessionLoaded || !tasks || hasSyncedOnLoad.current) return;
    hasSyncedOnLoad.current = true;

    if (activeSession && tasks.some((t) => t.id === activeSession.task_id)) {
      setFocusedTaskId(activeSession.task_id);
    } else if (focusedTaskId && !tasks.some((t) => t.id === focusedTaskId)) {
      setFocusedTaskId(null);
    }
  }, [activeSessionLoaded, activeSession, tasks, focusedTaskId, setFocusedTaskId]);

  const focusedTask = tasks?.find((t) => t.id === focusedTaskId);
  const currentSeconds = isRunningHere && activeSession ? sessionSeconds(activeSession, now) : 0;
  const totalTaskSeconds = taskSessions ? totalSeconds(taskSessions, now) : 0;

  function handlePlay() {
    if (focusedTaskId) startTimer.mutate(focusedTaskId);
  }

  function handlePause() {
    if (activeSession) stopTimer.mutate(activeSession.id);
  }

  function handleStop() {
    if (activeSession) stopTimer.mutate(activeSession.id);
    setFocusedTaskId(null);
  }

  const lastColumn = columns && columns.length > 0 ? columns[columns.length - 1] : null;
  const totalTasks = tasks?.length ?? 0;
  const doneTasks = lastColumn ? (tasks ?? []).filter((t) => t.column_id === lastColumn.id).length : 0;
  const doneRatio = totalTasks > 0 ? doneTasks / totalTasks : 0;

  const projectTotalHours = projectSessions ? totalHours(projectSessions, now) : 0;
  // Semana de calendario (lunes a domingo), no "últimos 7 días": es lo que se
  // espera al leer "esta semana" y lo que muestra Analytics.
  const weekHours = projectSessions ? summarize(projectSessions, now).thisWeek : 0;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 bg-surface-container rounded-lg p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
        <div className="absolute top-6 left-6 flex items-center gap-2 text-sm max-w-[80%]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${focusedTask ? "bg-primary-container" : "bg-outline"}`} />
          <span className="font-medium text-on-surface-variant truncate max-w-[140px]">{projectName}</span>
          <span className="text-on-surface-variant/40 shrink-0">/</span>
          <select
            value={focusedTaskId ?? ""}
            onChange={(e) => setFocusedTaskId(e.target.value || null)}
            aria-label="Seleccionar tarea"
            className="bg-transparent text-on-surface font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
          >
            <option value="" className="bg-surface-container-lowest text-on-surface-variant">
              Elige una tarea
            </option>
            {(tasks ?? []).map((t) => (
              <option key={t.id} value={t.id} className="bg-surface-container-lowest text-on-surface">
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col items-center gap-4 mt-8">
          <h2
            className={`text-6xl md:text-7xl font-black tracking-tighter tabular-nums ${
              focusedTask ? "text-primary" : "text-on-surface-variant/30"
            }`}
          >
            {formatDuration(currentSeconds)}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {focusedTask
              ? `Total en esta tarea: ${formatDuration(totalTaskSeconds)}`
              : "Elige una tarea del tablero (ícono ▶) para empezar a cronometrar."}
          </p>
          {runningElsewhere && (
            <p className="text-xs text-primary">
              Tienes un timer corriendo en otro proyecto. Iniciar uno aquí lo detendrá.
            </p>
          )}
          <div className="flex items-center gap-6 mt-4">
            {isRunningHere ? (
              <button
                type="button"
                onClick={handlePause}
                className="w-14 h-14 flex items-center justify-center bg-surface-bright border border-outline-variant/50 text-secondary rounded-full hover:bg-secondary-container transition-colors"
                aria-label="Pausar"
              >
                ❙❙
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={!focusedTask}
                className="w-20 h-20 flex items-center justify-center bg-primary-container text-on-primary rounded-full hover:bg-primary transition-colors shadow-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-primary-container"
                aria-label="Reanudar"
              >
                ▶
              </button>
            )}
            <button
              type="button"
              onClick={handleStop}
              disabled={!focusedTask}
              className="w-14 h-14 flex items-center justify-center bg-surface-bright border border-outline-variant/50 text-secondary rounded-full hover:bg-secondary-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-bright"
              aria-label="Detener"
            >
              ■
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-primary-container text-on-primary rounded-lg p-5 flex flex-col justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Sesión activa</span>
          <div>
            <p className="text-base font-bold leading-snug line-clamp-2">{focusedTask ? focusedTask.title : "Ninguna"}</p>
            <p className="text-xs mt-1 opacity-70">
              {isRunningHere ? "Corriendo" : focusedTask ? "En pausa" : "Sin iniciar"}
            </p>
          </div>
        </div>

        <StatCard
          icon={<ClockIcon className="w-4 h-4" />}
          label="Tiempo del proyecto"
          value={`${projectTotalHours.toFixed(1)}h`}
          hint={weekHours > 0 ? `+${weekHours.toFixed(1)}h esta semana` : "Sin actividad esta semana"}
        />

        {totalTasks > 0 && (
          <div className="bg-surface-container rounded-lg p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Tareas completadas
              </span>
              <CheckCircleIcon className="w-4 h-4 text-on-surface-variant" />
            </div>
            <p className="text-2xl font-bold text-on-surface">
              {doneTasks} <span className="text-sm font-normal text-on-surface-variant">/ {totalTasks}</span>
            </p>
            <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${doneRatio * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
