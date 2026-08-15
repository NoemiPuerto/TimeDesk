import { Avatar } from "../../components/Avatar";
import { useTeamMembers } from "./hooks";

export function TeamSidebarMembers({ teamId }: { teamId: string }) {
  const { data: members } = useTeamMembers(teamId);

  if (!members || members.length === 0) return null;

  return (
    <div className="px-4 mt-6">
      <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Tu equipo</p>
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2 px-1 py-1">
            <Avatar url={m.profile.avatar_url} name={m.profile.display_name} size="w-6 h-6" textSize="text-[9px]" />
            <span className="text-xs text-on-surface-variant truncate">
              {m.profile.display_name}
              {m.role === "admin" && <span className="opacity-60"> · admin</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
