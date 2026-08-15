import { create } from "zustand";

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
};

export const useAppStore = create<AppState>((set) => ({
  selectedProjectId: null,
  selectProject: (id) => set({ selectedProjectId: id }),
  focusedTaskId: null,
  setFocusedTaskId: (id) => set({ focusedTaskId: id }),
  selectedTeamId: null,
  selectTeam: (id) => set({ selectedTeamId: id, selectedProjectId: null }),
  activeNav: "dashboard",
  setActiveNav: (nav) => set({ activeNav: nav }),
}));
