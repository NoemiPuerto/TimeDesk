import { useMemo, useState } from "react";
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
import { useColumns, useTasks } from "../board/hooks";
import { useProjectSessions } from "../timer/hooks";
import { formatDuration } from "../timer/utils";
import { type BucketHours, fromDateKey, hoursByDay, hoursByMonth, hoursByTask, hoursByWeek, summarize } from "./utils";

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
  const bucket = payload[0].payload as BucketHours;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-on-surface-variant mb-1 capitalize">{bucket.sublabel ?? bucket.label}</p>
      <p className="text-sm font-bold text-on-surface">{formatHours(bucket.hours)}</p>
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

export function AnalyticsView({ projectId }: { projectId: string }) {
  const { data: sessions, isLoading } = useProjectSessions(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const now = Date.now();

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

  const doneColumnId = columns && columns.length > 0 ? columns[columns.length - 1].id : null;
  const doneTasks = (tasks ?? []).filter((t) => t.column_id === doneColumnId).length;

  const weekDelta = stats.thisWeek - stats.lastWeek;
  const openSessions = (sessions ?? []).filter((s) => !s.ended_at).length;
  const maxBucket = Math.max(...buckets.map((b) => b.hours), 0);

  if (isLoading) {
    return <p className="text-on-surface-variant text-sm">Cargando estadísticas...</p>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Todavía no hay tiempo registrado en este proyecto. Inicia un timer desde una tarea para ver estadísticas aquí.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8 min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile label="Total del proyecto" value={formatHours(stats.total)} hint={`${sessions.length} sesiones`} />
        <StatTile label="Hoy" value={formatHours(stats.today)} hint={openSessions > 0 ? "Timer corriendo" : undefined} />
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
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--outline-variant)" strokeOpacity={0.4} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34} unit="h" />
              <Tooltip content={BucketTooltip} cursor={cursorFill} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {buckets.map((b) => (
                  // El período en curso va translúcido: todavía no terminó y
                  // compararlo de igual a igual con los cerrados engaña.
                  <Cell
                    key={b.key}
                    fill="var(--primary)"
                    fillOpacity={b.key === buckets[buckets.length - 1].key ? 0.55 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

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
