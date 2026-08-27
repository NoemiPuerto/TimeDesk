import { useState } from "react";
import { Avatar } from "../../components/Avatar";
import { BellIcon } from "../../components/icons";
import { useDismissable } from "../../lib/useDismissable";
import { useAppStore } from "../../store/useAppStore";
import type { AppNotification, Invitation } from "./api";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyPendingInvitations,
  useNotifications,
  useRespondInvitation,
} from "./hooks";

function relativeTime(iso: string): string {
  const diffMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMinutes < 1) return "ahora";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const respond = useRespondInvitation();
  const [error, setError] = useState<string | null>(null);

  const target = invitation.kind === "team" ? invitation.team_name : invitation.project_name;
  const label = invitation.kind === "team" ? "al equipo" : "al proyecto";

  async function handleRespond(accept: boolean) {
    setError(null);
    try {
      await respond.mutateAsync({ invitationId: invitation.id, accept });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo responder la invitación.");
    }
  }

  return (
    <li className="flex flex-col gap-2 bg-surface-container rounded-md p-3">
      <div className="flex items-start gap-2">
        <Avatar
          url={invitation.inviter?.avatar_url}
          name={invitation.inviter?.display_name ?? "?"}
          size="w-7 h-7"
          textSize="text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-on-surface leading-snug">
            <span className="font-bold">{invitation.inviter?.display_name ?? "Alguien"}</span> te invitó {label}{" "}
            <span className="font-bold">{target ?? "sin nombre"}</span>
          </p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">{relativeTime(invitation.created_at)}</p>
        </div>
      </div>
      {error && <p className="text-error text-[10px]">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => handleRespond(false)}
          className="text-[11px] text-on-surface-variant px-2.5 py-1 rounded-full border border-outline-variant/40 hover:text-on-surface transition-colors disabled:opacity-50"
        >
          Rechazar
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => handleRespond(true)}
          className="text-[11px] bg-primary-container text-on-primary px-3 py-1 rounded-full font-medium hover:bg-primary transition-colors disabled:opacity-50"
        >
          Aceptar
        </button>
      </div>
    </li>
  );
}

export function NotificationBell({
  userId,
  onOpenProject,
}: {
  userId: string;
  onOpenProject: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useDismissable(open, () => setOpen(false));
  const { requestOpenTask } = useAppStore();

  const { data: invitations } = useMyPendingInvitations(userId);
  const { data: notifications } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);

  const pendingInvitations = invitations ?? [];
  const unread = (notifications ?? []).filter((n) => !n.read_at);
  const badgeCount = pendingInvitations.length + unread.length;

  function handleOpenNotification(n: AppNotification) {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.project_id) {
      // La tarea se abre después, cuando el tablero del proyecto ya montó.
      requestOpenTask(n.task_id);
      onOpenProject(n.project_id);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={badgeCount > 0 ? `Notificaciones (${badgeCount} sin leer)` : "Notificaciones"}
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <BellIcon className="w-[18px] h-[18px]" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notificaciones</h3>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-[10px] text-on-surface-variant underline hover:text-on-surface"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {pendingInvitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Invitaciones</p>
              <ul className="flex flex-col gap-2">
                {pendingInvitations.map((inv) => (
                  <InvitationRow key={inv.id} invitation={inv} />
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Menciones</p>
            {(notifications ?? []).length === 0 ? (
              <p className="text-xs text-on-surface-variant bg-surface-container rounded-md p-3">
                Cuando alguien escriba @tu-nombre en un comentario, aparecerá aquí.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(notifications ?? []).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(n)}
                      className={`w-full flex items-start gap-2 rounded-md p-2.5 text-left transition-colors hover:bg-surface-container-high ${
                        n.read_at ? "" : "bg-surface-container"
                      }`}
                    >
                      {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                      <Avatar
                        url={n.actor?.avatar_url}
                        name={n.actor?.display_name ?? "?"}
                        size="w-6 h-6"
                        textSize="text-[10px]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-on-surface">
                          <span className="font-bold">{n.actor?.display_name ?? "Alguien"}</span> te mencionó en{" "}
                          <span className="font-bold">{n.task_title ?? "una tarea"}</span>
                        </span>
                        <span className="block text-[11px] text-on-surface-variant line-clamp-2 mt-0.5">{n.body}</span>
                        <span className="block text-[10px] text-on-surface-variant/70 mt-0.5">
                          {relativeTime(n.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
