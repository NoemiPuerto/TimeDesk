import { useState, type FormEvent } from "react";
import { Avatar } from "../../components/Avatar";
import { useAuth } from "../auth/AuthProvider";
import { useDismissable } from "../../lib/useDismissable";
import { useAppStore } from "../../store/useAppStore";
import { useTeamMembers } from "../teams/hooks";
import { useInviteMember, useProjectMembers, useRemoveMember } from "./hooks";

export function MembersPanel({
  projectId,
  ownerId,
  teamId,
}: {
  projectId: string;
  ownerId: string;
  teamId?: string | null;
}) {
  const { user } = useAuth();
  const { selectProject } = useAppStore();
  const { data: members } = useProjectMembers(projectId);
  const { data: teamMembers } = useTeamMembers(teamId ?? null);
  const inviteMember = useInviteMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const containerRef = useDismissable(open, () => setOpen(false));

  const isOwner = user?.id === ownerId;
  const isTeamAdmin = teamMembers?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  const canManage = isOwner || isTeamAdmin;
  const atCapacity = (members?.length ?? 0) >= 4;

  function handleLeave() {
    if (!user) return;
    if (!confirm("¿Salir de este proyecto? Perderás acceso a sus tareas y tiempo registrado.")) return;
    removeMember.mutate(user.id);
    selectProject(null);
    setOpen(false);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await inviteMember.mutateAsync(email.trim());
      setEmail("");
      setNotice("Invitación enviada. Le aparecerá en su buzón para aceptarla o rechazarla.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar a esa persona.");
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center -space-x-2"
        onClick={() => setOpen((o) => !o)}
        aria-label="Miembros del proyecto"
      >
        {members?.map((m) => (
          <div key={m.user_id} title={m.profile.display_name} className="border-2 border-surface rounded-full">
            <Avatar url={m.profile.avatar_url} name={m.profile.display_name} size="w-8 h-8" />
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
              <li key={m.user_id} className="flex items-center gap-2 text-sm">
                <Avatar url={m.profile.avatar_url} name={m.profile.display_name} size="w-7 h-7" textSize="text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-on-surface truncate">{m.profile.display_name}</p>
                  <p className="text-on-surface-variant text-xs truncate">{m.profile.email}</p>
                </div>
                {canManage && m.user_id !== ownerId && (
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

          {canManage && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
              <input
                type="email"
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
                placeholder={
                  atCapacity
                    ? "Proyecto al máximo (4 miembros)"
                    : teamId
                      ? "Email de un miembro del equipo"
                      : "Email de la persona a invitar"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={atCapacity}
                required
              />
              {error && <p className="text-error text-xs">{error}</p>}
              {notice && <p className="text-on-surface-variant text-xs">{notice}</p>}
              <button
                type="submit"
                disabled={atCapacity || inviteMember.isPending}
                className="self-end text-xs bg-primary-container text-on-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary transition-colors disabled:opacity-50"
              >
                Invitar
              </button>
            </form>
          )}

          {!isOwner && (
            <button
              type="button"
              onClick={handleLeave}
              className="text-xs text-error text-left pt-2 border-t border-outline-variant/20"
            >
              Salir del proyecto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
