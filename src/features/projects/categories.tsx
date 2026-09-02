/**
 * Categoría de proyecto.
 *
 * Es una columna de texto libre con sugerencias, no un catálogo con su tabla:
 * así no hay que administrar nada ni añadir RLS, y si algún día hace falta un
 * catálogo por equipo, migrar los valores que ya existan es un `insert ...
 * select distinct`. Los presets son solo un empujón para que la gente no
 * escriba "diseño", "Diseño" y "DISEÑO" en tres proyectos distintos.
 */
export const PROJECT_CATEGORIES = [
  "Diseño",
  "Desarrollo",
  "Marketing",
  "Contenido",
  "Cliente",
  "Interno",
  "Personal",
];

const DATALIST_ID = "project-categories";

export function CategoryField({
  value,
  onChange,
  onCommit,
  disabled = false,
  id = "project-category",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Settings guarda al salir del campo; el alta guarda al enviar y no lo pasa. */
  onCommit?: () => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <>
      <input
        id={id}
        list={DATALIST_ID}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="Diseño, Desarrollo, Cliente..."
        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-60"
      />
      <datalist id={DATALIST_ID}>
        {PROJECT_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
