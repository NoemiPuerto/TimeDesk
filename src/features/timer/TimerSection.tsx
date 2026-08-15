import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useTasks } from "../board/hooks";
import { useActiveSession, useStartTimer, useStopTimer, useTaskSessions } from "./hooks";
import { formatDuration, sessionSeconds, totalSeconds } from "./utils";

export function TimerSection({ projectId }: { projectId: string }) {
  const { focusedTaskId, setFocusedTaskId } = useAppStore();
  const { data: activeSession, isSuccess: activeSessionLoaded } = useActiveSession();
  const { data: tasks } = useTasks(projectId);
  const { data: taskSessions } = useTaskSessions(focusedTaskId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const [now, setNow] = useState(() => Date.now());

  const isRunningHere = !!activeSession && activeSession.task_id === focusedTaskId;

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Recover a running timer after a page reload — runs once, the first time
  // the active-session query resolves. Must not re-run on every change or it
  // fights with handleStop's setFocusedTaskId(null) (stale cached
  // activeSession still non-null right after the stop mutation fires).
  const hasSyncedOnLoad = useRef(false);
  useEffect(() => {
    if (activeSessionLoaded && !hasSyncedOnLoad.current) {
      hasSyncedOnLoad.current = true;
      if (activeSession) setFocusedTaskId(activeSession.task_id);
    }
  }, [activeSessionLoaded, activeSession, setFocusedTaskId]);

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

  return (
    <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 bg-surface-container rounded-lg p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
        {focusedTask ? (
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <span className="text-sm font-medium text-on-surface">{focusedTask.title}</span>
          </div>
        ) : null}

        {focusedTask ? (
          <div className="flex flex-col items-center gap-4 mt-8">
            <h2 className="text-6xl md:text-7xl font-black tracking-tighter text-primary">
              {formatDuration(currentSeconds)}
            </h2>
            <p className="text-xs text-on-surface-variant">
              Total en esta tarea: {formatDuration(totalTaskSeconds)}
            </p>
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
                  className="w-20 h-20 flex items-center justify-center bg-primary-container text-on-primary rounded-full hover:bg-primary transition-colors shadow-lg"
                  aria-label="Reanudar"
                >
                  ▶
                </button>
              )}
              <button
                type="button"
                onClick={handleStop}
                className="w-14 h-14 flex items-center justify-center bg-surface-bright border border-outline-variant/50 text-secondary rounded-full hover:bg-secondary-container transition-colors"
                aria-label="Detener"
              >
                ■
              </button>
            </div>
          </div>
        ) : (
          <p className="text-on-surface-variant text-sm text-center max-w-xs">
            Elige una tarea del tablero (ícono ▶) para empezar a cronometrar.
          </p>
        )}
      </div>

      <div className="bg-primary-container text-on-primary rounded-lg p-5 flex flex-col justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-widest opacity-80">Sesión activa</span>
        <div>
          <p className="text-base font-bold leading-snug line-clamp-2">{focusedTask ? focusedTask.title : "Ninguna"}</p>
          <p className="text-xs mt-1 opacity-70">
            {isRunningHere ? "Corriendo" : focusedTask ? "En pausa" : "Sin iniciar"}
          </p>
        </div>
      </div>
    </section>
  );
}
