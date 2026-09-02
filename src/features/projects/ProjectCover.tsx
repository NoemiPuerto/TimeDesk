import { useRef, useState } from "react";
import { CameraIcon, TrashIcon } from "../../components/icons";

/**
 * Portada de un proyecto: la imagen que se haya subido o, si no hay,
 * un patrón generado a partir del id.
 *
 * El patrón NO es aleatorio: sale de un hash del id, así que un proyecto tiene
 * siempre el mismo y se reconoce de un vistazo en una rejilla llena. Lo único
 * que varía entre proyectos es el patrón, su escala, el ángulo del degradado y
 * dónde entra el negro — el color es siempre el primario `#eb3619` sobre
 * negro, sin inventar tonos nuevos fuera de la paleta.
 */

const PATTERNS = ["stripes", "dots", "rings", "chevrons", "grid"] as const;
type PatternKind = (typeof PATTERNS)[number];

/** Hash estable (djb2-ish). No es criptográfico: solo tiene que ser determinista. */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export type CoverLook = {
  kind: PatternKind;
  /** Lado de la celda del patrón, en unidades de usuario del SVG. */
  cell: number;
  angle: number;
  /** Dónde entra el negro en el degradado: cambia cuánto rojo se ve. */
  blackStop: number;
  patternId: string;
};

export function coverLook(seed: string): CoverLook {
  const hash = hashSeed(seed);
  return {
    kind: PATTERNS[hash % PATTERNS.length],
    cell: 14 + ((hash >> 3) % 5) * 5,
    angle: 100 + ((hash >> 6) % 5) * 20,
    blackStop: 38 + ((hash >> 9) % 4) * 9,
    patternId: `cover-${hash.toString(36)}`,
  };
}

function PatternShape({ kind, id, cell }: { kind: PatternKind; id: string; cell: number }) {
  const stroke = "#ffffff";
  const common = { fill: "none", stroke, strokeWidth: 1.25 } as const;

  return (
    <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">
      {kind === "stripes" && <path d={`M-1,1 l2,-2 M0,${cell} l${cell},-${cell} M${cell - 1},${cell + 1} l2,-2`} {...common} />}
      {kind === "dots" && <circle cx={cell / 2} cy={cell / 2} r={cell / 7} fill={stroke} />}
      {kind === "rings" && (
        <>
          <circle cx={cell / 2} cy={cell / 2} r={cell / 2.6} {...common} />
          <circle cx={cell / 2} cy={cell / 2} r={cell / 6} {...common} />
        </>
      )}
      {kind === "chevrons" && (
        <path d={`M0,${cell * 0.7} L${cell / 2},${cell * 0.3} L${cell},${cell * 0.7}`} {...common} />
      )}
      {kind === "grid" && <path d={`M${cell},0 L0,0 L0,${cell}`} {...common} />}
    </pattern>
  );
}

export function ProjectCover({
  coverUrl,
  seed,
  name,
  className = "",
  dimmed = false,
}: {
  coverUrl: string | null | undefined;
  /** Normalmente el id del proyecto: lo que hace que el patrón sea siempre el mismo. */
  seed: string;
  name: string;
  className?: string;
  /** Proyectos sin acceso: se apaga para que no compita con los que sí puedes abrir. */
  dimmed?: boolean;
}) {
  if (coverUrl) {
    return (
      <div className={`relative overflow-hidden bg-surface-container-high ${className}`}>
        <img
          src={coverUrl}
          alt=""
          className={`w-full h-full object-cover ${dimmed ? "opacity-30 grayscale" : ""}`}
        />
      </div>
    );
  }

  const look = coverLook(seed);

  return (
    <div
      className={`relative overflow-hidden ${dimmed ? "opacity-40 grayscale" : ""} ${className}`}
      style={{ background: `linear-gradient(${look.angle}deg, #eb3619 0%, #000000 ${look.blackStop}%)` }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.13]" aria-hidden="true">
        <defs>
          <PatternShape kind={look.kind} id={look.patternId} cell={look.cell} />
        </defs>
        <rect width="100%" height="100%" fill={`url(#${look.patternId})`} />
      </svg>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/15 font-black text-4xl leading-none select-none">
        {name.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Control de portada para los formularios: enseña la portada actual (o el
 * patrón por defecto) y deja subirla o quitarla.
 *
 * `onPick` recibe el fichero en crudo en vez de subirlo aquí porque al CREAR
 * un proyecto todavía no hay id al que asociar el objeto de Storage: el
 * formulario se guarda el fichero y lo sube después del alta.
 */
export function ProjectCoverField({
  coverUrl,
  previewUrl,
  seed,
  name,
  disabled = false,
  onPick,
  onRemove,
}: {
  coverUrl: string | null | undefined;
  /** URL local (`URL.createObjectURL`) de un fichero elegido y aún sin subir. */
  previewUrl?: string | null;
  seed: string;
  name: string;
  disabled?: boolean;
  onPick: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => void | Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la portada.");
    } finally {
      setBusy(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo tiene que ser una imagen.");
      return;
    }
    void run(() => onPick(file));
  }

  const shown = previewUrl ?? coverUrl;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative group rounded-md overflow-hidden">
        <ProjectCover coverUrl={shown} seed={seed} name={name || "P"} className="h-32" />

        {!disabled && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 group-hover:bg-black/50 transition-colors">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-surface-container text-on-surface text-xs font-medium px-3 py-1.5 rounded-full"
            >
              <CameraIcon className="w-3.5 h-3.5" />
              {busy ? "Guardando..." : shown ? "Cambiar" : "Subir portada"}
            </button>
            {shown && onRemove && (
              <button
                type="button"
                onClick={() => void run(() => onRemove())}
                disabled={busy}
                aria-label="Quitar portada"
                className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-full bg-surface-container text-on-surface-variant hover:text-error flex items-center justify-center"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-on-surface-variant">
        {shown ? "Se recorta al ancho de la tarjeta." : "Sin portada se usa un patrón propio del proyecto."}
      </p>
      {error && <p className="text-[11px] text-error">{error}</p>}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
    </div>
  );
}
