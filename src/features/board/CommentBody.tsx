import { parseCommentBody } from "./mentions";

/**
 * Pinta el cuerpo de un comentario resolviendo las menciones.
 *
 * El nombre se resuelve por id contra la lista de miembros, así que si alguien
 * se cambia el nombre, las menciones viejas pasan a mostrar el nuevo. El nombre
 * guardado dentro del token solo se usa como respaldo (por ejemplo si esa
 * persona ya no está en el proyecto).
 */
export function CommentBody({
  body,
  currentUserId,
  namesById,
}: {
  body: string;
  currentUserId?: string;
  namesById?: Map<string, string>;
}) {
  const segments = parseCommentBody(body);

  return (
    <p className="text-sm text-on-surface whitespace-pre-wrap break-words">
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <span
            key={index}
            // Siempre en el rojo de marca: una mención que se pinta como el
            // resto del texto parece que no se registró. A quien la recibe se
            // le añade fondo, para que localice de un vistazo dónde le hablan.
            className={`font-medium text-primary ${
              segment.userId === currentUserId ? "bg-primary-container/25 px-1 rounded-sm" : ""
            }`}
          >
            @{namesById?.get(segment.userId) ?? segment.name}
          </span>
        ),
      )}
    </p>
  );
}
