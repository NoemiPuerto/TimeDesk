import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useMyProjects } from "../projects/hooks";
import { MembersPanel } from "../projects/MembersPanel";
import { ProjectSwitcher } from "../projects/ProjectSwitcher";
import { useAppStore } from "../../store/useAppStore";
import { KanbanBoard } from "../board/KanbanBoard";
import { TimerSection } from "../timer/TimerSection";
import { AnalyticsView } from "../analytics/AnalyticsView";

const NAV_ITEMS = [
  { key: "timer", label: "Timer" },
  { key: "tasks", label: "Tasks" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
] as const;

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { data: projects, isLoading } = useMyProjects();
  const { selectedProjectId, selectProject } = useAppStore();
  const [activeNav, setActiveNav] = useState<(typeof NAV_ITEMS)[number]["key"]>("timer");

  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [projects, selectedProjectId, selectProject]);

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-background text-on-background flex">
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-outline-variant/20 bg-surface-container-low flex flex-col py-6 gap-2 z-40">
        <div className="px-4">
          <h1 className="text-lg font-bold text-primary">TimeDesk</h1>
        </div>

        <ProjectSwitcher />

        <nav className="flex-1 space-y-1 px-4 mt-6">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeNav === item.key
                  ? "bg-primary-container text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              onClick={() => setActiveNav(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 border-t border-outline-variant/20 pt-4">
          <p className="text-xs text-on-surface-variant truncate mb-2">{user?.email}</p>
          <button
            type="button"
            className="text-xs text-on-surface-variant hover:text-on-surface underline"
            onClick={signOut}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 w-full flex justify-between items-center px-6 h-16 bg-surface-container-low/80 backdrop-blur-sm border-b border-outline-variant/20 z-30">
          <h2 className="text-sm font-medium text-on-surface truncate">{selectedProject?.name ?? "TimeDesk"}</h2>
          {selectedProject && <MembersPanel projectId={selectedProject.id} ownerId={selectedProject.owner_id} />}
        </header>

        <div className="p-8 flex-1 overflow-y-auto">
          {isLoading && <p className="text-on-surface-variant text-sm">Cargando proyectos...</p>}

          {!isLoading && (!projects || projects.length === 0) && (
            <EmptyProjectsState />
          )}

          {!isLoading && selectedProject && (activeNav === "timer" || activeNav === "tasks") && (
            <div className="space-y-8">
              <TimerSection projectId={selectedProject.id} />
              <KanbanBoard projectId={selectedProject.id} />
            </div>
          )}

          {!isLoading && selectedProject && activeNav === "analytics" && (
            <AnalyticsView projectId={selectedProject.id} />
          )}

          {!isLoading && selectedProject && activeNav === "settings" && (
            <p className="text-on-surface-variant text-sm">Próximamente.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyProjectsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto mt-24">
      <div className="w-12 h-12 rounded-md bg-primary-container flex items-center justify-center text-on-primary font-bold">
        TD
      </div>
      <h3 className="text-lg font-bold text-on-surface">Crea tu primer proyecto</h3>
      <p className="text-on-surface-variant text-sm">
        Usa el selector de arriba a la izquierda para crear un proyecto y empezar a organizar tus tareas.
      </p>
    </div>
  );
}
