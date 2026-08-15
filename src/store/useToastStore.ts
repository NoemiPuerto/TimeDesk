import { create } from "zustand";

type Toast = { id: number; message: string };

type ToastState = {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
