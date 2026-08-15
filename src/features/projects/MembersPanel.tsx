import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useInviteMember, useProjectMembers, useRemoveMember } from "./hooks";

export function MembersPanel({ projectId, ownerId }: { projectId: string; ownerId: string }) {
  const { user } = useAuth();
  const { data: members } = useProjectMembers(projectId);
  const inviteMember = useInviteMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.id === ownerId;
  const atCapacity = (members?.length ?? 0) >= 4;

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await inviteMember.mutateAsync(email.trim());
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar a esa persona.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center -space-x-2"
        onClick={() => setOpen((o) => !o)}
        aria-label="Miembros del proyecto"
      >
        {members?.map((m) => (
          <div
            key={m.user_id}
            title={m.profile.display_name}
            className="w-8 h-8 rounded-full border-2 border-surface bg-secondary-container text-on-surface flex items-center justify-center text-xs font-bold"
          >
            {m.profile.display_name.slice(0, 1).toUpperCase()}
          </div>
        ))}
        <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs">
          +
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-3 flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {members?.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-on-surface truncate">{m.profile.display_name}</p>
                  <p className="text-on-surface-variant text-xs truncate">{m.profile.email}</p>
                </div>
                {isOwner && m.user_id !== ownerId && (
                  <button
                    type="button"
                    className="text-xs text-error shrink-0"
                    onClick={() => removeMember.mutate(m.user_id)}
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
              <input
                type="email"
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
                placeholder={atCapacity ? "Proyecto al máximo (4 miembros)" : "Email de la persona a invitar"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={atCapacity}
                required
              />
              {error && <p className="text-error text-xs">{error}</p>}
              <button
                type="submit"
                disabled={atCapacity || inviteMember.isPending}
                className="self-end text-xs bg-primary-container text-on-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary transition-colors disabled:opacity-50"
              >
                Invitar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
