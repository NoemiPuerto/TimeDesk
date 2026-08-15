import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useTasks } from "../board/hooks";
import { useProjectSessions } from "../timer/hooks";
import { hoursByDay, hoursByTask, totalHours } from "./utils";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-lg p-6 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <span className="text-4xl font-bold text-on-surface">{value}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 shadow-lg">
      {label && <p className="text-xs text-on-surface-variant mb-1">{label}</p>}
      <p className="text-sm font-bold text-on-surface">{Number(payload[0].value)}h</p>
    </div>
  );
}

const axisTick = { fill: "var(--on-surface-variant)", fontSize: 12 };
const cursorFill = { fill: "var(--primary-container)", opacity: 0.08 };

export function AnalyticsView({ projectId }: { projectId: string }) {
  const { data: sessions, isLoading } = useProjectSessions(projectId);
  const { data: tasks } = useTasks(projectId);
  const now = Date.now();

  const taskTitles = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t.title])), [tasks]);
  const daily = useMemo(() => hoursByDay(sessions ?? [], 7, now), [sessions, now]);
  const byTask = useMemo(() => hoursByTask(sessions ?? [], taskTitles, now), [sessions, taskTitles, now]);
  const total = totalHours(sessions ?? [], now);

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
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Horas totales" value={`${total.toFixed(1)}h`} />
        <StatTile label="Tareas con tiempo registrado" value={String(byTask.length)} />
        <StatTile label="Sesiones registradas" value={String(sessions.length)} />
      </div>

      <div className="bg-surface-container rounded-lg p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Horas por día (últimos 7 días)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--outline-variant)" strokeOpacity={0.4} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={ChartTooltip} cursor={cursorFill} />
            <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {byTask.length > 0 && (
        <div className="bg-surface-container rounded-lg p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Horas por tarea</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, byTask.length * 44)}>
            <BarChart data={byTask} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--outline-variant)" strokeOpacity={0.4} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="title"
                type="category"
                tick={{ fill: "var(--on-surface)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={140}
              />
              <Tooltip content={ChartTooltip} cursor={cursorFill} />
              <Bar dataKey="hours" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
