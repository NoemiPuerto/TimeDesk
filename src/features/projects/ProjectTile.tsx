import { Avatar } from "../../components/Avatar";
import { ClockIcon } from "../../components/icons";
import type { ProjectMember } from "./api";
import { ProjectCover } from "./ProjectCover";

/** "hace 2 días", "hace 3 h"… a partir de una fecha ISO. */
export function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.round(days / 30);
  return months === 1 ? "hace un mes" : `hace ${months} meses`;
}

/**
 * Tarjeta de proyecto: portada, nombre, descripción, categoría, quién participa
 * y cuándo se trabajó por última vez.
 *
 * La comparten el selector por ámbito (`ProjectChooser`) y la pestaña con todos
 * los proyectos (`AllProjectsView`); esta última le pasa además la etiqueta del
 * equipo, que dentro de un equipo sobra porque ya se sabe dónde estás.
 */
export function ProjectTile({
  id,
  name,
  description,
  coverUrl,
  category,
  teamName,
  lastActivity,
  members,
  hasAccess,
  onOpen,
}: {
  /** Semilla del patrón de portada: el mismo proyecto tiene siempre el mismo. */
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  /** Equipo al que pertenece; ausente en los proyectos personales. */
  teamName?: string | null;
  lastActivity?: string;
  members: ProjectMember[];
  hasAccess: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!hasAccess}
      title={hasAccess ? undefined : "Pídele acceso al administrador del equipo"}
      onClick={() => hasAccess && onOpen()}
      className={`group rounded-lg overflow-hidden flex flex-col text-left transition-all ${
        hasAccess
          ? "bg-surface-container hover:bg-surface-container-high hover:-translate-y-0.5"
          : "bg-surface-container/40 border border-dashed border-outline-variant/30 cursor-not-allowed"
      }`}
    >
      <div className="relative">
        <ProjectCover coverUrl={coverUrl} seed={id} name={name} className="h-24" dimmed={!hasAccess} />

        {/* Sobre la portada solo va lo que sitúa el proyecto: de qué equipo es
            y si está bloqueado. Lo demás compite con la imagen. */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {teamName ? (
            <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium max-w-[70%] truncate">
              {teamName}
            </span>
          ) : (
            <span />
          )}
          {!hasAccess && (
            <span className="px-2 py-0.5 rounded-full bg-black/70 text-white/80 text-[10px] font-medium shrink-0">
              🔒 Sin acceso
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-base font-bold leading-tight truncate ${
              hasAccess ? "text-on-surface" : "text-on-surface-variant/60"
            }`}
          >
            {name}
          </h4>
          {category && (
            <span className="shrink-0 px-2 py-0.5 rounded-full border border-outline-variant/40 text-on-surface-variant text-[10px] font-medium max-w-[45%] truncate">
              {category}
            </span>
          )}
        </div>

        {/* Altura reservada aunque no haya descripción: si no, las tarjetas de
            una misma fila quedan a distinta altura y la rejilla baila. */}
        <p className="text-xs leading-relaxed text-on-surface-variant line-clamp-2 min-h-[2rem]">
          {description || <span className="text-outline/70">Sin descripción</span>}
        </p>

        <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-outline-variant/10">
          {hasAccess && members.length > 0 ? (
            <div className="flex items-center -space-x-2">
              {members.slice(0, 4).map((m) => (
                <div
                  key={m.user_id}
                  title={m.profile.display_name}
                  className="border-2 border-surface-container group-hover:border-surface-container-high rounded-full transition-colors"
                >
                  <Avatar
                    url={m.profile.avatar_url}
                    name={m.profile.display_name}
                    size="w-6 h-6"
                    textSize="text-[10px]"
                  />
                </div>
              ))}
              {members.length > 4 && (
                <span className="w-6 h-6 rounded-full border-2 border-surface-container bg-surface-container-high text-on-surface-variant text-[10px] flex items-center justify-center">
                  +{members.length - 4}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}

          <span className="flex items-center gap-1 text-[11px] text-on-surface-variant shrink-0">
            {hasAccess && <ClockIcon className="w-3 h-3" />}
            {!hasAccess ? "" : lastActivity ? relativeTime(lastActivity) : "sin tiempo aún"}
          </span>
        </div>
      </div>
    </button>
  );
}
