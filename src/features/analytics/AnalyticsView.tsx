import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Avatar } from "../../components/Avatar";
import { useAuth } from "../auth/AuthProvider";
import { useColumns, useTasks } from "../board/hooks";
import { useProjectMembers } from "../projects/hooks";
import { useTeamMembers } from "../teams/hooks";
import { useProjectSessions } from "../timer/hooks";
import { formatDuration } from "../timer/utils";
import {
  type BucketHours,
  fromDateKey,
  hoursByDay,
  hoursByMonth,
  hoursByTask,
  hoursByWeek,
  summarize,
  summarizeByUser,
} from "./utils";

type Granularity = "day" | "week" | "month";

const GRANULARITIES: { key: Granularity; label: string; title: string; buckets: number }[] = [
  { key: "day", label: "Día", title: "Horas por día (últimos 14 días)", buckets: 14 },
  { key: "week", label: "Semana", title: "Horas por semana (últimas 12 semanas)", buckets: 12 },
  { key: "month", label: "Mes", title: "Horas por mes (últimos 12 meses)", buckets: 12 },
];

function formatHours(hours: number): string {
  if (hours === 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-surface-container rounded-lg p-4 sm:p-5 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-on-surface-variant truncate">
        {label}
      </span>
      <span className="text-2xl sm:text-3xl font-bold text-on-surface tabular-nums truncate">{value}</span>
      {hint && (
        <span
          className={`text-xs truncate ${
            tone === "up" ? "text-primary" : tone === "down" ? "text-on-surface-variant" : "text-on-surface-variant"
          }`}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function BucketTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload as BucketHours & { isCurrent?: boolean };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-on-surface-variant mb-1 first-letter:uppercase">{bucket.sublabel ?? bucket.label}</p>
      <p className="text-sm font-bold text-on-surface">
        {formatHours(bucket.hours)}
        {bucket.isCurrent && <span className="text-on-surface-variant font-normal text-xs"> · en curso</span>}
      </p>
    </div>
  );
}

function TaskTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { title: string; hours: number };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 shadow-lg max-w-[240px]">
      <p className="text-xs text-on-surface-variant mb-1 break-words">{row.title}</p>
      <p className="text-sm font-bold text-on-surface">{formatHours(row.hours)}</p>
    </div>
  );
}

const axisTick = { fill: "var(--on-surface-variant)", fontSize: 11 };
const cursorFill = { fill: "var(--primary-container)", opacity: 0.08 };

export function AnalyticsView({
  projectId,
  teamId,
  ownerId,
}: {
  projectId: string;
  teamId: string | null;
  ownerId: string;
}) {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useProjectSessions(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);
  const { data: projectMembers } = useProjectMembers(projectId);
  const { data: teamMembers } = useTeamMembers(teamId);
  const [granularity, setGranularity] = useState<Granularity>("day");
  // `now` como estado y no `Date.now()` en cada render: si cambiara en cada
  // render, ningún useMemo de abajo cachearía nada. Solo avanza mientras haya
  // una sesión abierta, que es lo único cuyo total crece con el reloj.
  const [now, setNow] = useState(() => Date.now());

  // Quién puede ver el tiempo del resto. En un proyecto de equipo lo decide la
  // política RLS de time_sessions (solo el admin recibe sesiones ajenas); acá
  // se repite la misma condición para no mostrar una tabla de una sola fila
  // que parezca un error. En un proyecto personal no hay admin: manda el dueño.
  const isTeamAdmin = teamMembers?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  const canSeeOthers = teamId ? isTeamAdmin : user?.id === ownerId;
  // Distinto de canSeeOthers: describe qué CONTIENEN los datos, no quién ve el
  // desglose. En un proyecto personal cualquier miembro recibe las sesiones de
  // todos (así quedó la RLS desde la Fase 1) aunque no le mostremos la tabla,
  // así que ahí "Total del proyecto" sigue siendo la etiqueta correcta.
  const dataIsMineOnly = !!teamId && !isTeamAdmin;

  const taskTitles = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t.title])), [tasks]);
  const stats = useMemo(() => summarize(sessions ?? [], now), [sessions, now]);

  const active = GRANULARITIES.find((g) => g.key === granularity)!;
  const buckets = useMemo(() => {
    const list = sessions ?? [];
    if (granularity === "week") return hoursByWeek(list, 12, now);
    if (granularity === "month") return hoursByMonth(list, 12, now);
    return hoursByDay(list, 14, now);
  }, [sessions, granularity, now]);

  const byTask = useMemo(() => hoursByTask(sessions ?? [], taskTitles, now, 8), [sessions, taskTitles, now]);

  const hasOpenSession = (sessions ?? []).some((s) => !s.ended_at);
  useEffect(() => {
    if (!hasOpenSession) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [hasOpenSession]);

  const perUser = useMemo(() => summarizeByUser(sessions ?? [], now), [sessions, now]);

  /** Una fila por miembro del proyecto, incluidos los que no registraron nada. */
  const memberRows = useMemo(() => {
    if (!canSeeOthers) return [];
    return (projectMembers ?? [])
      .map((m) => ({
        userId: m.user_id,
        name: m.profile.display_name,
        avatarUrl: m.profile.avatar_url,
        stats: perUser.get(m.user_id) ?? null,
      }))
      .sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0));
  }, [canSeeOthers, projectMembers, perUser]);

  const teamAverage = useMemo(() => {
    const withTime = memberRows.filter((r) => r.stats && r.stats.activeDays > 0);
    if (withTime.length === 0) return 0;
    return withTime.reduce((sum, r) => sum + r.stats!.avgPerActiveDay, 0) / withTime.length;
  }, [memberRows]);

  const doneColumnId = columns && columns.length > 0 ? columns[columns.length - 1].id : null;
  const doneTasks = (tasks ?? []).filter((t) => t.column_id === doneColumnId).length;

  const weekDelta = stats.thisWeek - stats.lastWeek;
  const maxBucket = Math.max(...buckets.map((b) => b.hours), 0);
  // La última cubeta siempre es el período en curso (hoy / esta semana / este
  // mes): todavía no terminó, y el tooltip lo aclara.
  const currentKey = buckets[buckets.length - 1]?.key;
  const chartData = useMemo(
    () => buckets.map((b) => ({ ...b, isCurrent: b.key === currentKey })),
    [buckets, currentKey],
  );
  const labelByKey = useMemo(() => new Map(buckets.map((b) => [b.key, b.label])), [buckets]);

  if (isLoading) {
    return <p className="text-on-surface-variant text-sm">Cargando estadísticas...</p>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        {dataIsMineOnly
          ? "Todavía no registraste tiempo en este proyecto. Inicia un timer desde una tarea para ver tus estadísticas aquí."
          : "Todavía no hay tiempo registrado en este proyecto. Inicia un timer desde una tarea para ver estadísticas aquí."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8 min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label={dataIsMineOnly ? "Tu tiempo aquí" : "Total del proyecto"}
          value={formatHours(stats.total)}
          hint={`${sessions.length} sesiones`}
        />
        <StatTile label="Hoy" value={formatHours(stats.today)} hint={hasOpenSession ? "Timer corriendo" : undefined} />
        <StatTile
          label="Esta semana"
          value={formatHours(stats.thisWeek)}
          hint={
            stats.lastWeek > 0
              ? `${weekDelta >= 0 ? "+" : "−"}${formatHours(Math.abs(weekDelta))} vs. semana pasada`
              : "Primera semana con registro"
          }
          tone={weekDelta >= 0 ? "up" : "down"}
        />
        <StatTile label="Este mes" value={formatHours(stats.thisMonth)} hint={`${stats.activeDays} días trabajados`} />
      </div>

      {dataIsMineOnly && (
        <p className="text-xs text-on-surface-variant -mt-2">
          En los proyectos de un equipo, cada persona ve solo su propio tiempo; el total del equipo lo ve el admin.
        </p>
      )}

      <section className="bg-surface-container rounded-lg p-4 sm:p-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{active.title}</h3>
          <div
            className="flex items-center gap-1 bg-surface-container-lowest rounded-full p-1 shrink-0"
            role="group"
            aria-label="Agrupar por"
          >
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGranularity(g.key)}
                aria-pressed={granularity === g.key}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  granularity === g.key
                    ? "bg-primary-container text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {maxBucket === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">
            No hay tiempo registrado en este período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240} minWidth={0}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--outline-variant)" strokeOpacity={0.4} />
              {/* dataKey es `key` (la fecha, única) y NO `label`: con 14 días los
                  nombres/números repetidos colapsaban en el eje de categorías y
                  las barras se dibujaban sobre la posición equivocada. */}
              <XAxis
                dataKey="key"
                tickFormatter={(key: string) => labelByKey.get(key) ?? key}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval={0}
                minTickGap={0}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34} unit="h" />
              <Tooltip content={BucketTooltip} cursor={cursorFill} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((b) => (
                  // El período en curso, en el mismo rojo pero atenuado: no
                  // terminó todavía y compararlo de igual a igual con los
                  // cerrados engaña. El tooltip lo dice con palabras.
                  <Cell key={b.key} fill="var(--primary)" fillOpacity={b.isCurrent ? 0.55 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {canSeeOthers && memberRows.length > 1 && (
        <section className="bg-surface-container rounded-lg p-4 sm:p-6 flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Tiempo por persona</h3>
            <p className="text-xs text-on-surface-variant/70">
              {teamId ? "Solo lo ve el admin del equipo" : "Solo lo ve el dueño del proyecto"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[420px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="text-left py-2 pr-4 font-bold">Persona</th>
                  <th className="text-right py-2 pr-4 font-bold">Promedio / día</th>
                  <th className="text-right py-2 pr-4 font-bold">Esta semana</th>
                  <th className="text-right py-2 pr-4 font-bold">Total</th>
                  <th className="text-right py-2 font-bold">Días</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.map((row) => {
                  const share = stats.total > 0 ? ((row.stats?.total ?? 0) / stats.total) * 100 : 0;
                  return (
                    <tr key={row.userId} className="border-t border-outline-variant/20">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar url={row.avatarUrl} name={row.name} size="w-7 h-7" textSize="text-[10px]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-on-surface truncate">
                              {row.name}
                              {row.userId === user?.id && (
                                <span className="text-on-surface-variant text-xs"> · tú</span>
                              )}
                            </p>
                            <div className="h-1 mt-1 rounded-full bg-surface-container-highest overflow-hidden max-w-[160px]">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-on-surface font-medium tabular-nums whitespace-nowrap">
                        {row.stats ? formatHours(row.stats.avgPerActiveDay) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-on-surface-variant tabular-nums whitespace-nowrap">
                        {row.stats ? formatHours(row.stats.thisWeek) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-on-surface-variant tabular-nums whitespace-nowrap">
                        {row.stats ? formatHours(row.stats.total) : "—"}
                      </td>
                      <td className="py-2.5 text-right text-on-surface-variant tabular-nums">
                        {row.stats?.activeDays ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-on-surface-variant">
            Promedio del equipo: <span className="text-on-surface font-medium">{formatHours(teamAverage)}</span> por día
            trabajado. El promedio de cada persona se calcula sobre los días en que registró tiempo, no sobre el
            calendario.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        <section className="xl:col-span-2 bg-surface-container rounded-lg p-4 sm:p-6 min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">
            Dónde se fue el tiempo
          </h3>
          {byTask.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Sin tiempo por tarea todavía.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, byTask.length * 40)} minWidth={0}>
              <BarChart data={byTask} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--outline-variant)" strokeOpacity={0.4} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} unit="h" />
                <YAxis
                  dataKey="title"
                  type="category"
                  tick={{ fill: "var(--on-surface)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
                />
                <Tooltip content={TaskTooltip} cursor={cursorFill} />
                <Bar dataKey="hours" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="bg-surface-container rounded-lg p-4 sm:p-6 flex flex-col gap-3 min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Ritmo</h3>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-on-surface-variant">Promedio por día trabajado</dt>
              <dd className="text-on-surface font-medium tabular-nums shrink-0">
                {formatHours(stats.avgPerActiveDay)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-on-surface-variant">Mejor día</dt>
              <dd className="text-on-surface font-medium tabular-nums shrink-0">
                {stats.bestDay
                  ? `${formatHours(stats.bestDay.hours)} · ${fromDateKey(stats.bestDay.key).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                    })}`
                  : "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-on-surface-variant">Sesión más larga</dt>
              <dd className="text-on-surface font-medium tabular-nums shrink-0">
                {formatDuration(Math.round(stats.longestSession * 3600))}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-on-surface-variant">Tareas con tiempo</dt>
              <dd className="text-on-surface font-medium tabular-nums shrink-0">
                {new Set(sessions.map((s) => s.task_id)).size}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-on-surface-variant">Tareas terminadas</dt>
              <dd className="text-on-surface font-medium tabular-nums shrink-0">
                {doneTasks}/{tasks?.length ?? 0}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
