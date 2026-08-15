import { useState, type FormEvent } from "react";
import { Avatar, AvatarUpload } from "../../components/Avatar";
import { useAuth } from "../auth/AuthProvider";
import { useAppStore } from "../../store/useAppStore";
import {
  useInviteTeamMember,
  useRemoveTeamAvatar,
  useRemoveTeamMember,
  useTeamMembers,
  useUploadTeamAvatar,
} from "./hooks";

export function TeamMembersPanel({
  teamId,
  ownerId,
  teamName,
  avatarUrl,
}: {
  teamId: string;
  ownerId: string;
  teamName: string;
  avatarUrl: string | null;
}) {
  const { user } = useAuth();
  const { selectTeam } = useAppStore();
  const { data: members } = useTeamMembers(teamId);
  const inviteMember = useInviteTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const uploadTeamAvatar = useUploadTeamAvatar(teamId);
  const removeTeamAvatar = useRemoveTeamAvatar(teamId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = members?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  const isOwner = user?.id === ownerId;

  function handleLeave() {
    if (!user) return;
    if (!confirm("¿Salir de este equipo? Perderás acceso a sus proyectos compartidos.")) return;
    removeMember.mutate(user.id);
    selectTeam(null);
    setOpen(false);
  }

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
        aria-label="Miembros del equipo"
      >
        {members?.map((m) => (
          <div
            key={m.user_id}
            title={`${m.profile.display_name}${m.role === "admin" ? " (admin)" : ""}`}
            className="border-2 border-surface rounded-full"
          >
            <Avatar url={m.profile.avatar_url} name={m.profile.display_name} size="w-8 h-8" />
          </div>
        ))}
        <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs">
          +
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/20">
            {isOwner ? (
              <AvatarUpload
                url={avatarUrl}
                name={teamName}
                size="w-11 h-11"
                onUpload={(file) => uploadTeamAvatar.mutateAsync(file)}
                onRemove={avatarUrl ? () => removeTeamAvatar.mutate() : undefined}
              />
            ) : (
              <Avatar url={avatarUrl} name={teamName} size="w-11 h-11" textSize="text-sm" />
            )}
            <p className="text-sm font-bold text-on-surface truncate">{teamName}</p>
          </div>

          <ul className="flex flex-col gap-2">
            {members?.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 text-sm">
                <Avatar url={m.profile.avatar_url} name={m.profile.display_name} size="w-7 h-7" textSize="text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-on-surface truncate">
                    {m.profile.display_name}
                    {m.role === "admin" && <span className="text-on-surface-variant text-xs"> · admin</span>}
                  </p>
                  <p className="text-on-surface-variant text-xs truncate">{m.profile.email}</p>
                </div>
                {isAdmin && m.user_id !== ownerId && (
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

          {isAdmin && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
              <input
                type="email"
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                placeholder="Email de la persona a invitar al equipo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="text-error text-xs">{error}</p>}
              <button
                type="submit"
                disabled={inviteMember.isPending}
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
              Salir del equipo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
