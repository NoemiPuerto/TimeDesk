import { create } from "zustand";

type AppState = {
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedProjectId: null,
  selectProject: (id) => set({ selectedProjectId: id }),
  focusedTaskId: null,
  setFocusedTaskId: (id) => set({ focusedTaskId: id }),
}));
