import { useEffect, useRef } from "react";
import { AvatarUpload } from "../../components/Avatar";
import { UpdateBanner } from "../../components/UpdateBanner";
import { BarChartIcon, ClockIcon, GridIcon, KanbanIcon, LogOutIcon, SettingsIcon } from "../../components/icons";
import { useAuth } from "../auth/AuthProvider";
import { DashboardView } from "../dashboard/DashboardView";
import { useMyProjects } from "../projects/hooks";
import { MembersPanel } from "../projects/MembersPanel";
import { ProjectSwitcher } from "../projects/ProjectSwitcher";
import { SettingsView } from "../settings/SettingsView";
import { useAppStore } from "../../store/useAppStore";
import { TaskBoardArea } from "../board/TaskBoardArea";
import { TimerSection } from "../timer/TimerSection";
import { AnalyticsView } from "../analytics/AnalyticsView";
import { NotificationBell } from "../notifications/NotificationBell";
import { useUserRealtime } from "../notifications/hooks";
import { useProjectRealtime } from "../realtime/useProjectRealtime";
import { useActiveSession } from "../timer/hooks";
import { useTimerLifecycle } from "../timer/useTimerLifecycle";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useMyProfile, useRemoveUserAvatar, useUploadUserAvatar } from "../profile/hooks";
import { TeamSidebarMembers } from "../teams/TeamSidebarMembers";
import { TeamSwitcher } from "../teams/TeamSwitcher";
import { TeamMembersPanel } from "../teams/TeamMembersPanel";
import { useMyTeams, useTeamProjects } from "../teams/hooks";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: GridIcon },
  { key: "timer", label: "Timer", icon: ClockIcon },
  { key: "tasks", label: "Tasks", icon: KanbanIcon },
  { key: "analytics", label: "Analytics", icon: BarChartIcon },
  { key: "settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { data: myProfile } = useMyProfile(user?.id ?? null);
  const uploadAvatar = useUploadUserAvatar(user?.id ?? null);
  const removeAvatar = useRemoveUserAvatar(user?.id ?? null);
  const { data: personalProjects, isLoading: personalLoading } = useMyProjects();
  const { selectedProjectId, selectProject, selectedTeamId, selectTeam, activeNav, setActiveNav } = useAppStore();
  const { data: teams } = useMyTeams();
  const { data: teamProjects, isLoading: teamProjectsLoading } = useTeamProjects(selectedTeamId);

  const { data: activeSession } = useActiveSession();

  useUserRealtime(user?.id ?? null);
  useTimerLifecycle({ enabled: !!user, hasActiveSession: !!activeSession });

  const isLoading = selectedTeamId ? teamProjectsLoading : personalLoading;
  const personalOnly = (personalProjects ?? []).filter((p) => !p.team_id);
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const hasNothingAtAll = !isLoading && personalOnly.length === 0 && (teams ?? []).length === 0;

  useEffect(() => {
    if (!selectedProjectId && !selectedTeamId && personalOnly.length > 0) {
      selectProject(personalOnly[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalProjects, selectedProjectId, selectedTeamId, selectProject]);

  // Sin proyectos propios pero con equipos (el caso de alguien recién invitado):
  // pararlo en "Personal" lo dejaba mirando una pantalla vacía sin pistas. Solo
  // una vez por sesión: si después elige "Personal" a propósito (por ejemplo
  // para crear su primer proyecto propio), no hay que devolverlo al equipo.
  const autoPickedTeamRef = useRef(false);
  useEffect(() => {
    if (autoPickedTeamRef.current) return;
    if (!selectedTeamId && personalOnly.length === 0 && (teams ?? []).length > 0) {
      autoPickedTeamRef.current = true;
      selectTeam(teams![0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, personalProjects, selectedTeamId]);

  // El equipo elegido queda guardado entre sesiones: si mientras tanto salió de
  // él (o se borró), hay que volver a "Personal" en vez de quedar en la nada.
  useEffect(() => {
    if (selectedTeamId && teams && !teams.some((t) => t.id === selectedTeamId)) {
      selectTeam(null);
    }
  }, [teams, selectedTeamId, selectTeam]);

  const selectedProject = selectedTeamId
    ? teamProjects?.find((p) => p.id === selectedProjectId && p.has_access)
    : personalOnly.find((p) => p.id === selectedProjectId);

  const { onlineMembers } = useProjectRealtime(selectedProject?.id ?? null);
  const online = useOnlineStatus();

  function handleOpenProject(project: { id: string; team_id: string | null }) {
    selectTeam(project.team_id ?? null);
    selectProject(project.id);
    setActiveNav("tasks");
  }

  function handleOpenProjectById(projectId: string) {
    const project = (personalProjects ?? []).find((p) => p.id === projectId);
    if (project) handleOpenProject(project);
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex">
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-error text-white text-xs text-center py-1.5">
          Sin conexión — los cambios se guardarán cuando vuelvas a estar en línea.
        </div>
      )}
      {online && <UpdateBanner />}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-outline-variant/20 bg-surface-container-low flex flex-col py-6 gap-2 z-40">
        <div className="px-4 flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="w-6 h-6 shrink-0" />
          <h1 className="text-lg font-bold text-primary">TimeDesk</h1>
        </div>

        <TeamSwitcher />
        <ProjectSwitcher />
        {selectedTeamId && <TeamSidebarMembers teamId={selectedTeamId} />}

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
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 border-t border-outline-variant/20 pt-4 flex items-center gap-3">
          <AvatarUpload
            url={myProfile?.avatar_url}
            name={myProfile?.display_name ?? user?.email ?? "?"}
            size="w-9 h-9"
            onUpload={(file) => uploadAvatar.mutateAsync(file)}
            onRemove={myProfile?.avatar_url ? () => removeAvatar.mutate() : undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors mt-1"
              onClick={signOut}
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 w-full flex justify-between items-center px-6 h-16 bg-surface-container-low/80 backdrop-blur-sm border-b border-outline-variant/20 z-30">
          <h2 className="text-sm font-medium text-on-surface truncate">
            {activeNav === "dashboard" ? "Dashboard" : (selectedProject?.name ?? selectedTeam?.name ?? "TimeDesk")}
          </h2>
          <div className="flex items-center gap-4">
            {user && <NotificationBell userId={user.id} onOpenProject={handleOpenProjectById} />}
            {activeNav !== "dashboard" && selectedProject && onlineMembers.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {onlineMembers.length} en línea
              </span>
            )}
            {activeNav !== "dashboard" && selectedTeam && !selectedProject && (
              <TeamMembersPanel
                teamId={selectedTeam.id}
                ownerId={selectedTeam.owner_id}
                teamName={selectedTeam.name}
                avatarUrl={selectedTeam.avatar_url}
              />
            )}
            {activeNav !== "dashboard" && selectedProject && (
              <MembersPanel
                projectId={selectedProject.id}
                ownerId={selectedProject.owner_id}
                teamId={selectedTeamId}
              />
            )}
          </div>
        </header>

        <div className="p-8 flex-1 overflow-y-auto">
          {hasNothingAtAll ? (
            <EmptyProjectsState />
          ) : (
            <>
              {activeNav === "dashboard" && user && (
                <DashboardView userId={user.id} onOpenProject={handleOpenProject} />
              )}

              {activeNav !== "dashboard" && (
                <>
                  {isLoading && <p className="text-on-surface-variant text-sm">Cargando proyectos...</p>}

                  {/* La configuración del equipo no necesita un proyecto elegido: sin
                      esta salvedad, los avisos de abajo taparían la única pantalla
                      desde donde se administra el equipo. */}
                  {activeNav !== "settings" && !isLoading && selectedTeamId && (teamProjects ?? []).length === 0 && (
                    <p className="text-on-surface-variant text-sm">
                      Este equipo todavía no tiene proyectos. Usa el selector de arriba a la izquierda para crear uno.
                    </p>
                  )}

                  {activeNav !== "settings" &&
                    !isLoading &&
                    selectedTeamId &&
                    (teamProjects ?? []).length > 0 &&
                    !selectedProject && (
                      <p className="text-on-surface-variant text-sm">
                        Elige un proyecto del equipo en el selector de arriba a la izquierda.
                      </p>
                    )}

                  {activeNav !== "settings" && !isLoading && !selectedTeamId && !selectedProject && (
                    <p className="text-on-surface-variant text-sm">
                      Elige un proyecto en el selector de arriba a la izquierda.
                    </p>
                  )}

                  {/* key por proyecto: sin esto, cambiar de proyecto reusa la misma
                      instancia y el estado local (columna destino, filtros, tarea
                      abierta) se arrastra del proyecto anterior. */}
                  {!isLoading && selectedProject && activeNav === "timer" && (
                    <div className="space-y-8">
                      <TimerSection
                        key={selectedProject.id}
                        projectId={selectedProject.id}
                        projectName={selectedProject.name}
                      />
                      <TaskBoardArea key={selectedProject.id} projectId={selectedProject.id} boardOnly />
                    </div>
                  )}

                  {!isLoading && selectedProject && activeNav === "tasks" && (
                    <TaskBoardArea
                      key={selectedProject.id}
                      projectId={selectedProject.id}
                      doneDisplayLimit={selectedProject.done_display_limit}
                    />
                  )}

                  {!isLoading && selectedProject && activeNav === "analytics" && (
                    <AnalyticsView projectId={selectedProject.id} />
                  )}

                  {activeNav === "settings" && (
                    <SettingsView project={selectedProject ?? null} team={selectedTeam ?? null} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyProjectsState() {
  const steps = [
    { label: "Crea tu primer proyecto", detail: "Usa el selector de arriba a la izquierda." },
    { label: "Añade tareas al tablero", detail: "Cada proyecto trae columnas To Do / In Progress / Done." },
    { label: "Inicia el timer", detail: "Toca el ícono ▶ de una tarea para empezar a cronometrar." },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center max-w-sm mx-auto mt-24">
      <div className="w-12 h-12 rounded-md bg-primary-container flex items-center justify-center text-on-primary font-bold">
        TD
      </div>
      <div>
        <h3 className="text-lg font-bold text-on-surface">Bienvenido a TimeDesk</h3>
        <p className="text-on-surface-variant text-sm mt-1">Tres pasos para empezar:</p>
      </div>
      <ol className="w-full flex flex-col gap-3 text-left">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-on-surface">{step.label}</p>
              <p className="text-xs text-on-surface-variant">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
