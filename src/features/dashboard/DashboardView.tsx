import { useMemo } from "react";
import { Avatar } from "../../components/Avatar";
import { AtSignIcon, KanbanIcon } from "../../components/icons";
import { totalHours } from "../analytics/utils";
import { useMyProfile } from "../profile/hooks";
import {
  useAccessibleProjects,
  useDashboardColumns,
  useDashboardComments,
  useDashboardSessions,
  useDashboardTasks,
} from "./hooks";

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "#eb3619" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#a3a3a3" },
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <div className="bg-surface-container rounded-lg p-5 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <span className={`text-3xl font-bold ${tone === "error" ? "text-error" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}

export function DashboardView({
  userId,
  onOpenProject,
}: {
  userId: string;
  onOpenProject: (project: { id: string; team_id: string | null }) => void;
}) {
  const { data: myProfile } = useMyProfile(userId);
  const { data: projects, isLoading: projectsLoading } = useAccessibleProjects(userId);
  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);

  const { data: tasks } = useDashboardTasks(projectIds);
  const { data: columns } = useDashboardColumns(projectIds);
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const { data: sessions } = useDashboardSessions(projectIds, since);
  const { data: comments } = useDashboardComments(projectIds);

  const now = Date.now();
  const todayKey = new Date().toISOString().slice(0, 10);

  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const lastColumnByProject = useMemo(() => {
    const byProject = new Map<string, { id: string; position: number }[]>();
    for (const c of columns ?? []) {
      const list = byProject.get(c.project_id) ?? [];
      list.push(c);
      byProject.set(c.project_id, list);
    }
    const map = new Map<string, string>();
    for (const [projectId, cols] of byProject) {
      const sorted = [...cols].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      if (last) map.set(projectId, last.id);
    }
    return map;
  }, [columns]);

  function isDone(t: { project_id: string; column_id: string }): boolean {
    return lastColumnByProject.get(t.project_id) === t.column_id;
  }

  const totalTasks = tasks?.length ?? 0;
  const doneTasks = (tasks ?? []).filter(isDone).length;
  const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
  const weekHours = sessions ? totalHours(sessions, now) : 0;

  const overdueTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.due_date && t.due_date < todayKey && !isDone(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, todayKey, lastColumnByProject],
  );

  const myDayTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.due_date && t.due_date <= todayKey && !isDone(t))
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, todayKey, lastColumnByProject],
  );

  const projectStats = useMemo(
    () =>
      (projects ?? []).map((p) => {
        const projectTasks = (tasks ?? []).filter((t) => t.project_id === p.id);
        const done = projectTasks.filter(isDone).length;
        return { project: p, total: projectTasks.length, done };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, tasks, lastColumnByProject],
  );

  const mentions = useMemo(() => {
    const myName = myProfile?.display_name?.trim().toLowerCase();
    if (!myName) return [];
    return (comments ?? [])
      .filter((c) => c.user_id !== userId && c.body.toLowerCase().includes(`@${myName}`))
      .slice(0, 5);
  }, [comments, myProfile, userId]);

  if (projectsLoading) {
    return <p className="text-on-surface-variant text-sm">Cargando dashboard...</p>;
  }

  if ((projects ?? []).length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Todavía no tienes proyectos. Usa el selector de arriba a la izquierda para crear uno.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Tareas completadas" value={String(doneTasks)} />
        <StatTile label="Tasa de finalización" value={`${completionRate.toFixed(0)}%`} />
        <StatTile label="Horas esta semana" value={`${weekHours.toFixed(1)}h`} />
        <StatTile
          label="Tareas vencidas"
          value={String(overdueTasks.length)}
          tone={overdueTasks.length > 0 ? "error" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Mi día</h3>
          {myDayTasks.length === 0 ? (
            <p className="text-sm text-on-surface-variant bg-surface-container rounded-lg p-6">
              No tienes tareas vencidas ni con fecha límite hoy.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {myDayTasks.map((t) => {
                const project = projectsById.get(t.project_id);
                const priority = t.priority ? PRIORITY_STYLE[t.priority] : null;
                const isOverdue = t.due_date! < todayKey;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => project && onOpenProject(project)}
                    className="flex items-center gap-3 bg-surface-container rounded-lg px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
                  >
                    {priority && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: priority.color }}
                        title={priority.label}
                      />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-on-surface truncate">{t.title}</span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        {project?.name ?? "Proyecto eliminado"}
                      </span>
                    </span>
                    <span className={`text-xs shrink-0 ${isOverdue ? "text-error font-medium" : "text-on-surface-variant"}`}>
                      {isOverdue ? "Vencida" : "Hoy"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              <AtSignIcon className="w-3.5 h-3.5" />
              Menciones recientes
            </h3>
            {mentions.length === 0 ? (
              <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-4">
                Nadie te ha mencionado todavía. Escribe @tu-nombre en un comentario para probarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {mentions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const project = projectsById.get(c.project_id);
                      if (project) onOpenProject(project);
                    }}
                    className="flex items-start gap-2 bg-surface-container rounded-lg p-3 text-left hover:bg-surface-container-high transition-colors"
                  >
                    <Avatar url={c.author.avatar_url} name={c.author.display_name} size="w-6 h-6" textSize="text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-on-surface">{c.author.display_name}</span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        en "{c.task?.title ?? "tarea eliminada"}"
                      </span>
                      <span className="block text-xs text-on-surface line-clamp-2 mt-0.5">{c.body}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              <KanbanIcon className="w-3.5 h-3.5" />
              Proyectos
            </h3>
            <div className="flex flex-col gap-2">
              {projectStats.map(({ project, total, done }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpenProject(project)}
                  className="flex flex-col gap-1.5 bg-surface-container rounded-lg p-3 text-left hover:bg-surface-container-high transition-colors"
                >
                  <span className="text-sm text-on-surface truncate">{project.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {done}/{total}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
