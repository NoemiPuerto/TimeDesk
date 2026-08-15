import { MutationCache, QueryClient } from "@tanstack/react-query";
import { useToastStore } from "../store/useToastStore";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _context, mutation) => {
      if (mutation.meta?.suppressToast) return;
      useToastStore.getState().push(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
    },
  }),
});
