import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavKey = "dashboard" | "timer" | "tasks" | "analytics" | "settings";

type AppState = {
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  /** null = "Personal" (non-team) projects. */
  selectedTeamId: string | null;
  selectTeam: (id: string | null) => void;
  activeNav: NavKey;
  setActiveNav: (nav: NavKey) => void;
  /**
   * Tarea que hay que abrir en el modal de detalle apenas se monte el tablero
   * del proyecto. Lo usan el Dashboard y el buzón de notificaciones para
   * llevarte a la tarea exacta de una mención, no solo al proyecto.
   */
  openTaskId: string | null;
  requestOpenTask: (taskId: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectProject: (id) => set({ selectedProjectId: id }),
      focusedTaskId: null,
      setFocusedTaskId: (id) => set({ focusedTaskId: id }),
      selectedTeamId: null,
      selectTeam: (id) => set({ selectedTeamId: id, selectedProjectId: null }),
      activeNav: "dashboard",
      setActiveNav: (nav) => set({ activeNav: nav }),
      openTaskId: null,
      requestOpenTask: (taskId) => set({ openTaskId: taskId }),
    }),
    {
      name: "timedesk-ui",
      // Solo el "dónde estaba": el equipo y el proyecto elegidos. La tarea del
      // timer viene del servidor (sesión activa) y el resto es efímero, así que
      // persistirlo solo daría estados raros al reabrir la app.
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
        selectedTeamId: state.selectedTeamId,
      }),
    },
  ),
);
