import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "../../components/Avatar";
import { CameraIcon, PlusIcon, TrashIcon } from "../../components/icons";
import { uploadProjectCover } from "../../lib/avatars";
import { useAppStore } from "../../store/useAppStore";
import { useToastStore } from "../../store/useToastStore";
import { useAuth } from "../auth/AuthProvider";
import { useTeamMembers } from "../teams/hooks";
import * as api from "./api";
import { CategoryField } from "./categories";
import { useCreateProject } from "./hooks";
import { ProjectCover } from "./ProjectCover";

export type TeamOption = { id: string; name: string };

const FIELD_CLASS =
  "w-full bg-surface-container-lowest border border-outline-variant/30 rounded-md px-4 py-3 text-base text-on-surface placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container";

/**
 * Ayuda que cambia según el campo en el que estés. Un bloque corto cada vez, en
 * lugar de un muro de texto que nadie lee: la duda concreta ("¿qué pongo en la
 * descripción?") aparece justo cuando surge.
 */
const HINTS = {
  default: {
    title: "Un proyecto es un contenedor de trabajo",
    lines: [
      "Dentro viven su tablero, sus tareas y el tiempo que registras.",
      "Puedes cambiar todo esto más tarde desde Settings.",
    ],
  },
  name: {
    title: "Ponle el nombre por el que lo llamas",
    lines: [
      "El que usarías al hablar con alguien del equipo, no un código interno.",
      "Se ve en la barra lateral, en la tarjeta y en los informes.",
    ],
  },
  description: {
    title: "Cómo describir el proyecto",
    lines: [
      "En una o dos frases: qué se quiere conseguir y para quién.",
      "Añade cómo sabrás que está terminado, si hay un final claro.",
      "Evita repetir el nombre; en la tarjeta se ven los dos juntos.",
    ],
  },
  category: {
    title: "Para qué sirve la categoría",
    lines: [
      "Agrupa proyectos parecidos: Diseño, Desarrollo, Marketing, Cliente…",
      "Reutiliza las que ya usas — se busca por ella en la lista de proyectos.",
      "Es texto libre: si ninguna encaja, escribe la tuya.",
    ],
  },
  cover: {
    title: "La portada",
    lines: [
      "Cualquier imagen que te ayude a reconocer el proyecto de un vistazo.",
      "Si no subes ninguna, se genera un patrón propio del proyecto.",
    ],
  },
  members: {
    title: "Cómo funcionan las invitaciones",
    lines: [
      "No entran de golpe: reciben una invitación y entran al aceptarla.",
      "En un proyecto de equipo solo puedes invitar a quien ya está en el equipo.",
      "Un proyecto admite hasta 4 personas.",
    ],
  },
} as const;

type HintKey = keyof typeof HINTS;

function Field({
  label,
  children,
  onFocus,
}: {
  label: string;
  children: ReactNode;
  onFocus: () => void;
}) {
  return (
    <label className="flex flex-col gap-2" onFocus={onFocus} onMouseEnter={onFocus}>
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

/**
 * Alta de proyecto: una capa que ocupa todo el área de contenido —sin tapar la
 * barra lateral ni la cabecera— en dos paneles. A la izquierda la portada
 * ocupando todo el alto, que hace de vista previa de cómo quedará la tarjeta,
 * más la ayuda contextual; a la derecha el formulario.
 *
 * `teamOptions` solo se pasa desde la pestaña de todos los proyectos, donde no
 * hay un ámbito activo y hay que preguntar a qué equipo va. Cuando se crea
 * dentro de un equipo concreto, el destino ya está decidido y el selector
 * sobra.
 *
 * Orden de las operaciones: primero se crea el proyecto y después se le cuelgan
 * portada, categoría e invitaciones. No es capricho — la portada se guarda en
 * `avatars/projects/{id}`, así que hasta que no existe el proyecto no hay ruta
 * a la que subirla. Por eso el formulario se queda el fichero en memoria en vez
 * de subirlo al elegirlo.
 */
export function CreateProjectForm({
  teamId,
  teamOptions,
  onDone,
}: {
  teamId: string | null;
  teamOptions?: TeamOption[];
  onDone: () => void;
}) {
  const createProject = useCreateProject();
  const { user } = useAuth();
  const { selectProject, selectTeam } = useAppStore();
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState<string>(teamId ?? "personal");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<HintKey>("default");

  const fileInputRef = useRef<HTMLInputElement>(null);
  // El patrón definitivo lo genera el id del proyecto, que todavía no existe:
  // esta semilla fija hace que la vista previa no cambie de dibujo en cada
  // tecla, y el pie de foto avisa de que es solo un ejemplo.
  const previewSeed = useRef(Math.random().toString(36).slice(2)).current;

  const destination = teamOptions ? (target === "personal" ? null : target) : teamId;
  const { data: teamMembers } = useTeamMembers(destination);

  // Objeto URL para la vista previa: hay que revocarlo o se filtra memoria cada
  // vez que se cambia de imagen.
  const previewUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Al cambiar de destino, las invitaciones elegidas dejan de valer: las de un
  // equipo son sus miembros, y en personal son correos sueltos.
  useEffect(() => setInvites([]), [destination]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onDone]);

  const invitableMembers = (teamMembers ?? []).filter((m) => m.user_id !== user?.id);

  function toggleInvite(email: string) {
    setInvites((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  }

  function addEmailInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || invites.includes(email)) return;
    setInvites((prev) => [...prev, email]);
    setInviteEmail("");
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverError("El archivo tiene que ser una imagen.");
      return;
    }
    setCoverError(null);
    setCoverFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({ name: trimmed, description, teamId: destination });

      // Lo accesorio no puede tumbar el alta: el proyecto ya existe, así que un
      // fallo aquí se avisa pero no deshace nada ni deja el formulario colgado.
      const failures: string[] = [];

      if (category.trim()) {
        try {
          await api.updateProject(project.id, { category: category.trim() });
        } catch {
          failures.push("la categoría");
        }
      }
      if (coverFile) {
        try {
          await uploadProjectCover(project.id, coverFile);
        } catch {
          failures.push("la portada");
        }
      }
      for (const email of invites) {
        try {
          await api.inviteMemberByEmail(project.id, email);
        } catch {
          failures.push(`la invitación a ${email}`);
        }
      }

      if (failures.length > 0) {
        pushToast(`Se creó "${trimmed}", pero no se pudo guardar ${failures.join(", ")}.`);
      }

      // El ámbito tiene que seguir al proyecto: si se creó en un equipo y la app
      // está en "Personal", el proyecto nuevo no aparecería por ningún lado.
      selectTeam(destination);
      selectProject(project.id);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const activeHint = HINTS[hint];
  const shownCover = previewUrl;

  return (
    /* Ocupa el área de contenido, no la pantalla entera: la barra lateral
       (`w-64 fixed`) y la cabecera (`h-16`) siguen a la vista y usables. Va
       `fixed` y no `absolute` porque el contenedor de la vista tiene su propio
       scroll, y con `absolute` la capa se desplazaría con él. El z-index queda
       POR DEBAJO del de la cabecera (z-30) para que sus paneles —la campana de
       notificaciones— sigan abriéndose por encima. */
    <div className="fixed top-16 left-64 right-0 bottom-0 z-20 bg-background grid grid-cols-1 lg:grid-cols-[minmax(0,38%)_1fr] overflow-y-auto lg:overflow-hidden">
      {/* ── Panel izquierdo: la portada ocupa todo el alto ───────────────── */}
      <aside className="relative min-h-[240px] lg:h-full overflow-hidden">
        {/* El envoltorio es quien va posicionado: `ProjectCover` lleva
            `relative` en su clase base y Tailwind resuelve el conflicto por el
            orden de SUS reglas, no por el del atributo, así que pasarle
            `absolute` por className no lo saca del flujo — se comía el alto del
            panel y empujaba este contenido fuera de la pantalla. */}
        <div className="absolute inset-0">
          <ProjectCover coverUrl={shownCover} seed={previewSeed} name={name || "P"} className="w-full h-full" />
        </div>
        {/* El texto va sobre una imagen que elige otra persona: sin este velo
            no hay forma de garantizar que se lea. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/25" />

        <div className="relative h-full flex flex-col justify-between p-8 gap-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Nuevo proyecto</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setHint("cover")}
                className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              >
                <CameraIcon className="w-3.5 h-3.5" />
                {shownCover ? "Cambiar portada" : "Subir portada"}
              </button>
              {shownCover && (
                <button
                  type="button"
                  onClick={() => setCoverFile(null)}
                  aria-label="Quitar portada"
                  className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white/80 hover:text-error flex items-center justify-center transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Vista previa de la tarjeta, con lo que se está escribiendo. */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {category.trim() && (
                <span className="px-2.5 py-0.5 rounded-full border border-white/30 text-white/80 text-[11px] font-medium">
                  {category.trim()}
                </span>
              )}
              {destination && teamOptions && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-medium">
                  {teamOptions.find((t) => t.id === destination)?.name}
                </span>
              )}
            </div>

            <h2 className={`text-3xl font-bold leading-tight ${name.trim() ? "text-white" : "text-white/35"}`}>
              {name.trim() || "Nombre del proyecto"}
            </h2>

            <p className="text-sm text-white/70 line-clamp-3 min-h-[1.25rem]">{description.trim()}</p>

            {coverError ? (
              <p className="text-xs text-error">{coverError}</p>
            ) : (
              !shownCover && (
                <p className="text-[11px] text-white/45">
                  Sin portada se genera un patrón propio del proyecto. Este es un ejemplo: el definitivo se crea con
                  el proyecto.
                </p>
              )
            )}

            <div className="mt-4 pt-4 border-t border-white/15">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">{activeHint.title}</p>
              <ul className="flex flex-col gap-1">
                {activeHint.lines.map((line) => (
                  <li key={line} className="text-xs text-white/70 leading-relaxed flex gap-2">
                    <span className="text-primary shrink-0">·</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
      </aside>

      {/* ── Panel derecho: el formulario ─────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col lg:h-full lg:overflow-hidden">
        <header className="px-8 py-6 border-b border-outline-variant/20 shrink-0">
          <div className="max-w-2xl w-full flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Crear un proyecto</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Solo el nombre es obligatorio; lo demás se puede cambiar luego.
            </p>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center shrink-0 transition-colors"
          >
            ✕
            </button>
          </div>
        </header>

        <div className="flex-1 lg:overflow-y-auto px-8 py-6 flex flex-col gap-8 max-w-2xl w-full">
          <section className="flex flex-col gap-5">
            <Field label="Nombre" onFocus={() => setHint("name")}>
              <input
                autoFocus
                className={FIELD_CLASS}
                placeholder="Rediseño del portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Descripción" onFocus={() => setHint("description")}>
              <textarea
                className={`${FIELD_CLASS} min-h-[120px] resize-y leading-relaxed`}
                placeholder="¿Qué se quiere conseguir y para quién?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6 border-t border-outline-variant/20">
            <Field label="Categoría" onFocus={() => setHint("category")}>
              <CategoryField value={category} onChange={setCategory} id="new-project-category" />
            </Field>

            {teamOptions && (
              <Field label="Dónde se crea" onFocus={() => setHint("default")}>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className={FIELD_CLASS}>
                  <option value="personal">Personal</option>
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </section>

          <section
            className="flex flex-col gap-3 pt-6 border-t border-outline-variant/20"
            onMouseEnter={() => setHint("members")}
            onFocus={() => setHint("members")}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Integrantes</span>

            {/* En un proyecto de equipo solo se puede invitar a quien ya está en
                el equipo (lo exige `invite_project_member`), así que se elige de
                una lista en vez de ofrecer un campo de correo que fallaría al
                enviar. */}
            {destination ? (
              invitableMembers.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  No hay nadie más en este equipo todavía. Invítalos al equipo primero, desde Settings.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {invitableMembers.map((member) => {
                    const selected = invites.includes(member.profile.email);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => toggleInvite(member.profile.email)}
                        className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary-container/15 text-on-surface"
                            : "border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        <Avatar
                          url={member.profile.avatar_url}
                          name={member.profile.display_name}
                          size="w-6 h-6"
                          textSize="text-[10px]"
                        />
                        {member.profile.display_name}
                        {selected && <span className="text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    className={FIELD_CLASS}
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEmailInvite();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addEmailInvite}
                    className="flex items-center gap-1 text-sm text-primary font-medium px-3 py-3 shrink-0"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Añadir
                  </button>
                </div>
                {invites.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {invites.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-high text-sm text-on-surface"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => toggleInvite(email)}
                          aria-label={`Quitar ${email}`}
                          className="text-on-surface-variant hover:text-error"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <footer className="px-8 py-5 border-t border-outline-variant/20 shrink-0">
          <div className="max-w-2xl w-full flex items-center justify-end gap-3">
          <button type="button" onClick={onDone} className="text-sm text-on-surface-variant px-4 py-2.5">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="text-sm bg-primary-container text-on-primary px-6 py-2.5 rounded-full font-medium hover:bg-primary transition-colors disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear proyecto"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
