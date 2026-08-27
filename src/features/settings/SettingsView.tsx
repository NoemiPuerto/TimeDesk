import { useState } from "react";
import { Avatar, AvatarUpload } from "../../components/Avatar";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../auth/AuthProvider";
import { useCancelInvitation, usePendingProjectInvitations, usePendingTeamInvitations } from "../notifications/hooks";
import type { Project } from "../projects/api";
import { ProjectSettings } from "../projects/ProjectSettings";
import { useInviteMember, useProjectMembers, useRemoveMember } from "../projects/hooks";
import type { Team } from "../teams/api";
import {
  useDeleteTeam,
  useInviteTeamMember,
  useRemoveTeamAvatar,
  useRemoveTeamMember,
  useTeamMembers,
  useUpdateTeam,
  useUploadTeamAvatar,
} from "../teams/hooks";
import { MembersTable, type MemberRow } from "./MembersTable";

const MAX_PROJECT_MEMBERS = 4;

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{title}</h3>
      {hint && <p className="text-xs text-on-surface-variant/80">{hint}</p>}
    </div>
  );
}

function ProjectMembersSection({ project, teamId }: { project: Project; teamId: string | null }) {
  const { user } = useAuth();
  const { data: members } = useProjectMembers(project.id);
  const { data: teamMembers } = useTeamMembers(teamId);
  const { data: invitations } = usePendingProjectInvitations(project.id);
  const inviteMember = useInviteMember(project.id);
  const removeMember = useRemoveMember(project.id);
  const cancelInvitation = useCancelInvitation();

  const isOwner = user?.id === project.owner_id;
  const isTeamAdmin = teamMembers?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  const canManage = isOwner || isTeamAdmin;
  const atCapacity = (members?.length ?? 0) >= MAX_PROJECT_MEMBERS;

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    userId: m.user_id,
    displayName: m.profile.display_name,
    email: m.profile.email,
    avatarUrl: m.profile.avatar_url,
    roleLabel: m.user_id === project.owner_id ? "Dueño" : "Miembro",
    joinedAt: m.joined_at,
    removable: m.user_id !== project.owner_id,
  }));

  function handleRemove(userId: string) {
    const member = rows.find((r) => r.userId === userId);
    if (!confirm(`¿Quitar a ${member?.displayName ?? "esta persona"} del proyecto? Perderá acceso a sus tareas.`)) return;
    removeMember.mutate(userId);
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        title="Integrantes del proyecto"
        hint={
          teamId
            ? `Solo miembros del equipo pueden entrar a este proyecto. Máximo ${MAX_PROJECT_MEMBERS}.`
            : `Quién puede ver y editar este tablero. Máximo ${MAX_PROJECT_MEMBERS} personas.`
        }
      />
      <MembersTable
        members={rows}
        invitations={invitations ?? []}
        canManage={canManage}
        invitePlaceholder={teamId ? "Email de un miembro del equipo" : "Email de la persona a invitar"}
        inviteDisabledReason={atCapacity ? `Proyecto al máximo (${MAX_PROJECT_MEMBERS} miembros)` : null}
        onRemove={handleRemove}
        onCancelInvitation={(id) => cancelInvitation.mutate(id)}
        onInvite={(email) => inviteMember.mutateAsync(email)}
      />
    </section>
  );
}

function TeamSettingsSection({ team }: { team: Team }) {
  const { user } = useAuth();
  const { selectTeam } = useAppStore();
  const { data: members } = useTeamMembers(team.id);
  const { data: invitations } = usePendingTeamInvitations(team.id);
  const inviteMember = useInviteTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);
  const cancelInvitation = useCancelInvitation();
  const updateTeam = useUpdateTeam(team.id);
  const deleteTeam = useDeleteTeam();
  const uploadAvatar = useUploadTeamAvatar(team.id);
  const removeAvatar = useRemoveTeamAvatar(team.id);
  const [name, setName] = useState(team.name);

  const isOwner = user?.id === team.owner_id;
  const isAdmin = members?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    userId: m.user_id,
    displayName: m.profile.display_name,
    email: m.profile.email,
    avatarUrl: m.profile.avatar_url,
    roleLabel: m.user_id === team.owner_id ? "Dueño" : m.role === "admin" ? "Admin" : "Miembro",
    joinedAt: m.joined_at,
    removable: m.user_id !== team.owner_id,
  }));

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== team.name) updateTeam.mutate({ name: trimmed });
    else setName(team.name);
  }

  function handleRemove(userId: string) {
    const member = rows.find((r) => r.userId === userId);
    const isSelf = userId === user?.id;
    const message = isSelf
      ? "¿Salir de este equipo? Perderás acceso a sus proyectos compartidos."
      : `¿Quitar a ${member?.displayName ?? "esta persona"} del equipo? Perderá acceso a sus proyectos.`;
    if (!confirm(message)) return;
    removeMember.mutate(userId);
    if (isSelf) selectTeam(null);
  }

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar el equipo "${team.name}"? Sus proyectos NO se borran: cada uno vuelve a ser un proyecto personal de quien lo creó, y el resto del equipo deja de verlos.`,
      )
    )
      return;
    deleteTeam.mutate(team.id, { onSuccess: () => selectTeam(null) });
  }

  return (
    <section className="flex flex-col gap-6">
      <SectionHeading title="Equipo" />

      <div className="flex items-start gap-5">
        {isOwner ? (
          <AvatarUpload
            url={team.avatar_url}
            name={team.name}
            size="w-16 h-16"
            onUpload={(file) => uploadAvatar.mutateAsync(file)}
            onRemove={team.avatar_url ? () => removeAvatar.mutate() : undefined}
          />
        ) : (
          <Avatar url={team.avatar_url} name={team.name} size="w-16 h-16" textSize="text-lg" />
        )}
        <div className="flex-1 flex flex-col gap-2 max-w-sm">
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Nombre del equipo
          </label>
          <input
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-60"
            value={name}
            disabled={!isOwner}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          {!isOwner && (
            <p className="text-xs text-on-surface-variant">Solo el dueño del equipo puede cambiar el nombre y la foto.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading
          title="Integrantes del equipo"
          hint="Estar en el equipo deja ver qué proyectos existen; el acceso al contenido de cada proyecto lo da un admin desde la configuración de ese proyecto."
        />
        <MembersTable
          members={rows}
          invitations={invitations ?? []}
          canManage={isAdmin}
          invitePlaceholder="Email de la persona a invitar al equipo"
          onRemove={handleRemove}
          onCancelInvitation={(id) => cancelInvitation.mutate(id)}
          onInvite={(email) => inviteMember.mutateAsync(email)}
        />
      </div>

      {isOwner ? (
        <div className="border-t border-outline-variant/20 pt-6 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-error uppercase tracking-widest">Zona de peligro</h3>
          <p className="text-xs text-on-surface-variant max-w-lg">
            Eliminar el equipo quita a todos sus integrantes y deshace la agrupación. Los proyectos no se borran: cada
            uno vuelve a ser personal de quien lo creó.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            className="self-start text-sm text-error px-4 py-2 rounded-md border border-error/40 hover:bg-error/10 transition-colors"
          >
            Eliminar equipo
          </button>
        </div>
      ) : (
        <div className="border-t border-outline-variant/20 pt-6">
          <button
            type="button"
            onClick={() => user && handleRemove(user.id)}
            className="text-sm text-error px-4 py-2 rounded-md border border-error/40 hover:bg-error/10 transition-colors"
          >
            Salir del equipo
          </button>
        </div>
      )}
    </section>
  );
}

export function SettingsView({ project, team }: { project: Project | null; team: Team | null }) {
  const { user } = useAuth();

  if (!project && !team) {
    return (
      <p className="text-on-surface-variant text-sm">
        Elige un equipo o un proyecto en el selector de arriba a la izquierda para configurarlo.
      </p>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-12">
      {project && (
        <div className="flex flex-col gap-8">
          <ProjectSettings project={project} isOwner={user?.id === project.owner_id} />
          <ProjectMembersSection project={project} teamId={project.team_id} />
        </div>
      )}
      {team && <TeamSettingsSection team={team} />}
    </div>
  );
}
