import { useState, type FormEvent } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useCreateTeam, useMyTeams } from "./hooks";

export function TeamSwitcher() {
  const { data: teams } = useMyTeams();
  const { selectedTeamId, selectTeam } = useAppStore();
  const createTeam = useCreateTeam();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const selected = teams?.find((t) => t.id === selectedTeamId);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const team = await createTeam.mutateAsync(trimmed);
    selectTeam(team.id);
    setName("");
    setCreating(false);
    setOpen(false);
  }

  return (
    <div className="relative px-2 mt-4">
      <button
        type="button"
        aria-label="Selector de equipo"
        className="w-full flex items-center justify-between px-1 py-1.5 rounded-md text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{selected ? selected.name : "Personal"}</span>
        <span className="shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute left-2 right-2 mt-1 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-2">
          {!creating ? (
            <>
              <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                <li>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-surface-container-high transition-colors ${
                      !selectedTeamId ? "text-primary font-medium" : "text-on-surface"
                    }`}
                    onClick={() => {
                      selectTeam(null);
                      setOpen(false);
                    }}
                  >
                    Personal
                  </button>
                </li>
                {teams?.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-surface-container-high transition-colors ${
                        team.id === selectedTeamId ? "text-primary font-medium" : "text-on-surface"
                      }`}
                      onClick={() => {
                        selectTeam(team.id);
                        setOpen(false);
                      }}
                    >
                      {team.name}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded-sm text-sm text-primary font-medium hover:bg-surface-container-high transition-colors mt-1 border-t border-outline-variant/20 pt-2"
                onClick={() => setCreating(true)}
              >
                + Nuevo equipo
              </button>
            </>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-2 p-1">
              <input
                autoFocus
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                placeholder="Nombre del equipo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  className="text-xs text-on-surface-variant px-2 py-1"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs bg-primary-container text-on-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary transition-colors"
                >
                  Crear
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
