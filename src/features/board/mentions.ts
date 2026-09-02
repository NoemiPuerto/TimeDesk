/**
 * Menciones vinculadas a una persona, no a su nombre escrito.
 *
 * En el cuerpo del comentario una mención se guarda como `@[Nombre](uuid)`. El
 * uuid es lo que vale: renombrarse no rompe una mención ya escrita, y dos
 * personas con nombres parecidos no se confunden. Antes esto era una búsqueda
 * de texto (`position('@' || display_name in body)`), que fallaba en los dos
 * casos.
 *
 * El nombre viaja dentro del token solo como respaldo para pintarlo cuando no
 * se puede resolver el id contra la lista de miembros.
 */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
/** El nombre no admite `]` ni saltos de línea, así que el token no se puede romper. */
const MENTION_SOURCE = `@\\[([^\\]\\n]{1,80})\\]\\((${UUID})\\)`;

export type BodySegment =
  | { type: "text"; value: string }
  | { type: "mention"; userId: string; name: string };

export function buildMentionToken(name: string, userId: string): string {
  // Los corchetes y los saltos de línea romperían el token, o dejarían un
  // nombre a medias al pintarlo; se sustituyen por un espacio.
  return `@[${name.replace(/[[\]\n]/g, " ").replace(/\s+/g, " ").trim()}](${userId})`;
}

/** Trocea el cuerpo en texto y menciones, en orden, para poder pintarlo. */
export function parseCommentBody(body: string): BodySegment[] {
  const regex = new RegExp(MENTION_SOURCE, "g");
  const segments: BodySegment[] = [];
  let lastIndex = 0;

  for (let match = regex.exec(body); match !== null; match = regex.exec(body)) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", name: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) segments.push({ type: "text", value: body.slice(lastIndex) });
  return segments;
}

/** El cuerpo tal cual se lee, con los tokens convertidos en `@Nombre`. */
export function mentionsToPlainText(body: string): string {
  return body.replace(new RegExp(MENTION_SOURCE, "g"), "@$1");
}

export function extractMentionUserIds(body: string): string[] {
  const regex = new RegExp(MENTION_SOURCE, "g");
  const ids = new Set<string>();
  for (let match = regex.exec(body); match !== null; match = regex.exec(body)) {
    ids.add(match[2]);
  }
  return [...ids];
}

/**
 * ¿Se está escribiendo una mención justo antes del cursor?
 *
 * Se exige que la `@` esté al principio o tras un espacio, para no disparar el
 * autocompletado dentro de un email. La consulta no admite espacios: para
 * nombres compuestos basta con escribir la primera parte y filtrar.
 */
export function findMentionQuery(textBeforeCaret: string): { query: string; start: number } | null {
  const match = /(?:^|\s)@([^\s@[\]()]{0,40})$/.exec(textBeforeCaret);
  if (!match) return null;
  return { query: match[1], start: match.index + match[0].indexOf("@") };
}

export type MentionSpan = { start: number; end: number; userId: string; name: string };

/**
 * Dónde está cada mención dentro del texto VISIBLE (`@Nombre`).
 *
 * Es la única fuente de verdad para las dos cosas que dependen de ello: pintar
 * la mención en rojo mientras se escribe y convertirla a token al enviar. Al
 * salir de aquí ambas, lo que se ve resaltado es exactamente lo que quedará
 * vinculado — que es justo la duda que genera verlo en blanco.
 *
 * Se recorren los nombres de más largo a más corto: si no, "@Ana" ocuparía el
 * principio de "@Ana María" y dejaría la mención larga partida. Cada entrada de
 * la lista consume una sola aparición, así que mencionar dos veces a la misma
 * persona requiere dos entradas (que es lo que produce elegirla dos veces).
 */
export function locateMentions(text: string, mentions: { name: string; userId: string }[]): MentionSpan[] {
  const taken = new Array<boolean>(text.length).fill(false);
  const spans: MentionSpan[] = [];

  for (const mention of [...mentions].sort((a, b) => b.name.length - a.name.length)) {
    const needle = `@${mention.name}`;
    for (let from = 0; from <= text.length - needle.length; ) {
      const index = text.indexOf(needle, from);
      if (index === -1) break;

      const end = index + needle.length;
      const overlaps = taken.slice(index, end).some(Boolean);
      if (!overlaps) {
        for (let i = index; i < end; i++) taken[i] = true;
        spans.push({ start: index, end, userId: mention.userId, name: mention.name });
        break;
      }
      from = index + 1;
    }
  }

  return spans.sort((a, b) => a.start - b.start);
}

/** Trocea el texto visible en fragmentos normales y menciones, para pintarlo. */
export function splitByMentions(
  text: string,
  mentions: { name: string; userId: string }[],
): { type: "text" | "mention"; value: string }[] {
  const spans = locateMentions(text, mentions);
  const parts: { type: "text" | "mention"; value: string }[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) parts.push({ type: "text", value: text.slice(cursor, span.start) });
    parts.push({ type: "mention", value: text.slice(span.start, span.end) });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}

/**
 * Convierte lo que se VE en el editor a lo que se GUARDA.
 *
 * Mientras se escribe, el textarea muestra `@Nombre` a secas: el uuid es un
 * detalle interno y no tiene por qué salir a la vista. Al enviar, cada mención
 * que se eligió de la lista se sustituye por su token con id.
 *
 * Si alguien editó el nombre a mano después de elegirlo, no habrá coincidencia
 * y se quedará como texto plano — que es justo lo correcto: ya no señala a esa
 * persona con certeza, así que no debe notificarla.
 */
export function displayToStorage(text: string, mentions: { name: string; userId: string }[]): string {
  const spans = locateMentions(text, mentions);
  let output = text;

  // De atrás hacia delante: así los índices de los tramos anteriores siguen
  // siendo válidos después de cada sustitución.
  for (const span of [...spans].reverse()) {
    output = output.slice(0, span.start) + buildMentionToken(span.name, span.userId) + output.slice(span.end);
  }

  return output;
}

export type MentionCandidate = { userId: string; name: string; avatarUrl: string | null };

/** Filtra por coincidencia en cualquier parte, pero prioriza las que empiezan igual. */
export function filterCandidates(candidates: MentionCandidate[], query: string): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return candidates;

  return candidates
    .filter((c) => c.name.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });
}
