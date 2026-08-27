import { useState, type FormEvent } from "react";
import { Avatar } from "../../components/Avatar";
import type { Invitation } from "../notifications/api";

export type MemberRow = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: string;
  joinedAt: string;
  /** El dueño/creador no se puede quitar: hay que borrar el equipo o proyecto. */
  removable: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Tabla de integrantes compartida por la configuración de proyecto y la de
 * equipo: quién está dentro, con qué rol, desde cuándo, quién tiene invitación
 * pendiente y los botones para quitar o cancelar.
 */
export function MembersTable({
  members,
  invitations,
  canManage,
  invitePlaceholder,
  inviteDisabledReason,
  onRemove,
  onCancelInvitation,
  onInvite,
}: {
  members: MemberRow[];
  invitations: Invitation[];
  canManage: boolean;
  invitePlaceholder: string;
  inviteDisabledReason?: string | null;
  onRemove: (userId: string) => void;
  onCancelInvitation: (invitationId: string) => void;
  onInvite: (email: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await onInvite(email.trim());
      setEmail("");
      setNotice("Invitación enviada. Aparecerá en su buzón de notificaciones para aceptarla o rechazarla.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar a esa persona.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <th className="py-2 pr-4 font-bold">Persona</th>
              <th className="py-2 pr-4 font-bold">Rol</th>
              <th className="py-2 pr-4 font-bold">Desde</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t border-outline-variant/20">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar url={m.avatarUrl} name={m.displayName} size="w-8 h-8" />
                    <div className="min-w-0">
                      <p className="text-on-surface truncate">{m.displayName}</p>
                      <p className="text-xs text-on-surface-variant truncate">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-on-surface-variant text-xs whitespace-nowrap">{m.roleLabel}</td>
                <td className="py-2.5 pr-4 text-on-surface-variant text-xs whitespace-nowrap">
                  {formatDate(m.joinedAt)}
                </td>
                <td className="py-2.5 text-right">
                  {canManage && m.removable && (
                    <button
                      type="button"
                      onClick={() => onRemove(m.userId)}
                      className="text-xs text-error hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {invitations.map((inv) => (
              <tr key={inv.id} className="border-t border-outline-variant/20">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      url={inv.invitee?.avatar_url}
                      name={inv.invitee?.display_name ?? "?"}
                      size="w-8 h-8"
                    />
                    <div className="min-w-0">
                      <p className="text-on-surface-variant truncate">{inv.invitee?.display_name ?? "—"}</p>
                      <p className="text-xs text-on-surface-variant truncate">{inv.invitee?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="text-[10px] uppercase tracking-widest text-primary">Invitación pendiente</span>
                </td>
                <td className="py-2.5 pr-4 text-on-surface-variant text-xs whitespace-nowrap">
                  {formatDate(inv.created_at)}
                </td>
                <td className="py-2.5 text-right">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onCancelInvitation(inv.id)}
                      className="text-xs text-on-surface-variant hover:text-error hover:underline"
                    >
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2 max-w-md">
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
              placeholder={inviteDisabledReason ?? invitePlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!inviteDisabledReason}
              required
            />
            <button
              type="submit"
              disabled={!!inviteDisabledReason || submitting}
              className="text-sm bg-primary-container text-on-primary px-4 py-2 rounded-md font-medium hover:bg-primary transition-colors disabled:opacity-50 shrink-0"
            >
              Invitar
            </button>
          </div>
          {error && <p className="text-error text-xs">{error}</p>}
          {notice && <p className="text-on-surface-variant text-xs">{notice}</p>}
        </form>
      )}
    </div>
  );
}
