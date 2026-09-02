import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "../../components/Avatar";
import { useDismissable } from "../../lib/useDismissable";
import { filterCandidates, findMentionQuery, splitByMentions, type MentionCandidate } from "./mentions";

/**
 * Textarea con autocompletado de menciones.
 *
 * Al escribir `@` se abre la lista de miembros; se filtra al teclear, se navega
 * con flechas y se elige con Enter, Tab o clic.
 *
 * En el editor se ve `@Nombre` y nada más: el id es un detalle interno y no
 * debe salir a la vista. Cada vez que se elige a alguien se avisa por
 * `onMentionInsert`; quien use el componente guarda esa lista y la aplica con
 * `displayToStorage` al enviar. La lista vive fuera porque el botón de enviar
 * suele estar fuera de este componente.
 *
 * Las menciones se pintan en rojo mientras se escriben. Un `<textarea>` no
 * admite texto de colores por dentro, así que se usa la técnica habitual: una
 * capa con el mismo texto justo detrás, coloreada, y el texto del textarea en
 * transparente dejando solo el cursor. Ambas capas comparten clases para que
 * las métricas (tipografía, relleno, borde) coincidan al píxel; si divergen, el
 * texto pintado se desalinea del cursor.
 */
export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  onMentionInsert,
  mentions,
  candidates,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Se dispara al elegir a alguien de la lista, para poder resolverla al enviar. */
  onMentionInsert: (mention: { name: string; userId: string }) => void;
  /** Menciones ya elegidas: son las que se pintan en rojo y las que se vincularán. */
  mentions: { name: string; userId: string }[];
  candidates: MentionCandidate[];
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Posición del cursor a aplicar tras insertar; null cuando no hay nada pendiente. */
  const pendingCaret = useRef<number | null>(null);

  const containerRef = useDismissable(query !== null, () => setQuery(null));

  const matches = query ? filterCandidates(candidates, query.query).slice(0, 6) : [];
  const open = query !== null && matches.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [query?.query]);

  // El cursor se coloca después de que React haya pintado el valor nuevo; si se
  // hiciera antes, el propio re-render lo mandaría al final del texto.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  function refreshQuery(el: HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    setQuery(findMentionQuery(el.value.slice(0, caret)));
  }

  function insertMention(candidate: MentionCandidate) {
    const el = textareaRef.current;
    if (!el || !query) return;

    const caret = el.selectionStart ?? value.length;
    // Se inserta el nombre visible, no el token: el uuid se aplica al enviar.
    const visible = `@${candidate.name} `;
    const next = value.slice(0, query.start) + visible + value.slice(caret);

    pendingCaret.current = query.start + visible.length;
    setQuery(null);
    onMentionInsert({ name: candidate.name, userId: candidate.userId });
    onChange(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative flex-1 min-w-0" ref={containerRef}>
      <div className="relative">
        <div
          ref={backdropRef}
          aria-hidden
          className={`${className} absolute inset-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words`}
        >
          {splitByMentions(value, mentions).map((part, index) =>
            part.type === "mention" ? (
              <span key={index} className="text-primary font-medium">
                {part.value}
              </span>
            ) : (
              <span key={index}>{part.value}</span>
            ),
          )}
          {/* Mantiene la altura de la última línea cuando el texto acaba en salto. */}
          {"\u200b"}
        </div>

        <textarea
          ref={textareaRef}
          // `block` es imprescindible: un textarea es inline-block por defecto y
          // deja un hueco de interlineado bajo él, con lo que el contenedor
          // queda más alto que el propio campo y la capa `inset-0` de atrás no
          // coincide con la caja del texto.
          className={`${className} relative block bg-transparent text-transparent placeholder:text-on-surface-variant/70`}
          style={{ caretColor: "var(--on-surface)" }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            refreshQuery(e.target);
          }}
          // El cursor puede moverse sin escribir (flechas, clic): hay que
          // recalcular si sigue dentro de una mención a medio escribir.
          onKeyUp={(e) => refreshQuery(e.currentTarget)}
          onClick={(e) => refreshQuery(e.currentTarget)}
          onKeyDown={handleKeyDown}
          // La capa de atrás no se desplaza sola: hay que seguir al textarea.
          onScroll={(e) => {
            if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {open && (
        <ul
          role="listbox"
          aria-label="Miembros para mencionar"
          className="absolute bottom-full left-0 mb-2 w-64 max-h-52 overflow-y-auto bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-1"
        >
          {matches.map((candidate, index) => (
            <li key={candidate.userId}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // mousedown y no click: el click llega después del blur del
                // textarea, que ya habría cerrado la lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(candidate);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left text-sm transition-colors ${
                  index === activeIndex ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant"
                }`}
              >
                <Avatar url={candidate.avatarUrl} name={candidate.name} size="w-6 h-6" textSize="text-[10px]" />
                <span className="truncate">{candidate.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
