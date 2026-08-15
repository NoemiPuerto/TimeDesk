# TimeDesk

## Visión del producto
App de escritorio de time tracking y productividad personal para freelancers, con capacidad de compartir proyectos en equipos pequeños (2-4 personas).

## Problema que resuelve
El usuario organiza su trabajo en **proyectos**. Cada proyecto tiene su propio **kanban** (columnas personalizables por el usuario, ej. To Do / In Progress / Done) con tareas. El usuario decide en qué tarea está trabajando e **inicia un timer** sobre ella; el sistema registra sesiones de tiempo (inicio/fin) por tarea. A partir de esas sesiones se generan **estadísticas** de horas trabajadas por tarea, por proyecto y generales.

## Usuario objetivo
- Principal: freelancers e individuos gestionando su propio tiempo y proyectos.
- Secundario: equipos pequeños (2-4 personas) que comparten uno o varios proyectos y su kanban.

## Casos de uso clave (v1)
1. Crear/editar/eliminar proyectos.
2. Invitar miembros a un proyecto (2-4 personas) para colaborar sobre el mismo kanban.
3. Definir columnas personalizadas del kanban por proyecto y gestionar tareas dentro de ellas (crear, mover entre columnas, editar, eliminar).
4. Iniciar/pausar/detener un timer sobre una tarea específica; solo un timer activo por usuario a la vez.
5. Ver el historial de sesiones de tiempo por tarea.
6. Ver estadísticas básicas: horas totales por proyecto, por día/semana, y vista general de productividad (gráficos simples).
7. Ver actualizaciones del kanban compartido en tiempo real cuando hay más de un miembro en el proyecto.

## Fuera de alcance en el MVP (explícito)
- Integraciones externas (Google/Outlook Calendar, Slack, Trello, etc.).
- Aplicación móvil (iOS/Android).
- Facturación/invoicing a clientes en base a horas — **asumido fuera de v1 por no formar parte del problema principal descrito; confirmar con el usuario si se requiere antes de planear la fase que la incluiría.**

## Sistema de diseño

**Paleta activa (decisión explícita del usuario, agosto 2026): fondo negro + rojo primario `#EB3619`.** Reemplaza la paleta verde salvia originalmente extraída de Stitch (ver "Origen histórico" abajo) — no es un tema claro/oscuro alternable, es la única piel de la app (`:root` y `.dark` tienen los mismos valores).

### Tokens de color

| Token | Valor |
|---|---|
| `background` / `surface` | `#000000` |
| `surface-container-lowest` | `#0d0d0d` |
| `surface-container-low` | `#161616` |
| `surface-container` | `#1f1f1f` |
| `surface-container-high` | `#292929` |
| `surface-container-highest` | `#333333` |
| `on-background` / `on-surface` | `#f5f5f5` |
| `on-surface-variant` | `#a3a3a3` |
| `outline` | `#666666` |
| `outline-variant` | `#383838` |
| `primary` / `primary-container` | `#eb3619` |
| `on-primary` | `#ffffff` |
| `secondary` | `#d4d4d4` |
| `secondary-container` | `#292929` |
| `error` | `#ff5233` (distinto de `primary` a propósito, para no confundir "marca" con "error/peligro") |

| Token de radio | Valor |
|---|---|
| `radius.sm` | 6px (inputs, controles pequeños) |
| `radius.md` | 10px (cards, contenedores) |
| `radius.lg` | 16px (secciones principales) |
| `radius.full` | 9999px (pills, tags, botones circulares del timer) |

### Principios de UI
- Diseño plano por defecto: sin sombras pesadas, separación por contraste tonal entre superficies (`surface` → `surface-container` → `surface-container-high`), no por líneas divisorias.
- Jerarquía tipográfica: Display grande para el timer activo, Heading para secciones, Body para tareas, Caption para metadatos. Tipografía: **Inter**.
- Una sola acción primaria dominante por vista (botón `primary-container` sólido); acciones secundarias en outline/ghost.
- Layout: sidebar fijo de navegación (Timer/Tasks/Analytics/Settings), header superior, sección "bento" del timer activo (más ancha que la tarjeta de "sesión activa" contigua) + kanban personalizable debajo. Columnas de kanban a `w-64`; controles secundarios (añadir columna) como ícono compacto con tooltip, no como input de ancho completo, para minimizar el scroll horizontal del tablero.

### Origen histórico (superseded)
La paleta original venía de [Stitch project 2566146179284865822](https://stitch.withgoogle.com/projects/2566146179284865822) (verde salvia `#859c71`, fondo crema/oscuro, tipografía Inter) — ver el historial de git de este archivo para la tabla de tokens completa si hace falta retomarla. Los *principios* de layout y jerarquía tipográfica de esa exploración siguen vigentes; solo la paleta de color cambió.

## Stack tecnológico

| Capa | Elección | Motivo |
|---|---|---|
| Shell de escritorio | **Tauri** (Rust) | Binarios livianos, bajo consumo de memoria, mejor para una app que corre en segundo plano/bandeja del sistema que Electron. |
| Frontend | **React + TypeScript + Vite** | Ecosistema maduro, tipado fuerte, DX rápida. |
| Estilos/UI | **Tailwind CSS + shadcn/ui**, tokens y tipografía **Inter** según el [sistema de diseño](#sistema-de-diseño) (negro + rojo `#EB3619`) | Componentes accesibles y personalizables; tokens centralizados en `src/index.css`, no hardcodeados por componente. |
| Drag & drop (kanban) | **dnd-kit** | Estándar actual para tableros kanban en React, accesible y performante. |
| Estado servidor | **TanStack Query** | Cache y sincronización de datos remotos (Supabase). |
| Estado local/UI | **Zustand** | Estado del timer activo, UI, sin boilerplate. |
| Gráficos | **Recharts** | Suficiente para estadísticas básicas (barras/líneas), fácil de extender. |
| Backend/DB/Auth | **Supabase** (Postgres + Auth + Realtime + Row Level Security) | Cloud desde el día 1 sin construir backend propio: auth, permisos por proyecto vía RLS, y Realtime para el kanban compartido. |

## Reglas de arquitectura
- **Cloud desde el inicio**: no hay modo "solo local"; todos los datos viven en Supabase/Postgres. La app debe manejar con gracia la ausencia de conexión (mostrar estado, no perder datos en vuelo) pero el soporte offline completo NO es parte del MVP.
- **Permisos por proyecto**: cada proyecto tiene un dueño y miembros (máx. 4). El acceso a boards/tareas/sesiones se controla con Row Level Security en Supabase, no en el cliente.
- **Un timer activo por usuario**: la lógica de negocio debe impedir dos timers corriendo simultáneamente para el mismo usuario, sin importar el proyecto.
- **Kanban personalizable por proyecto**: modelo de datos `Project -> Board -> Columns -> Tasks`, con columnas creadas/renombradas/reordenadas por el usuario (no hardcodeadas).
- **Sesiones de tiempo como fuente de verdad**: las estadísticas se calculan siempre a partir de `time_sessions` (inicio/fin), nunca de contadores acumulados editables directamente.
- **Realtime solo donde aporta valor**: se usa Supabase Realtime para el estado del kanban y presencia básica en proyectos compartidos; no para todo el estado de la app.
- **INSERT en tablas con foreign keys pasa por RPC, no por `supabase.from(...).insert(...)` directo**: en el/los proyecto(s) de Supabase usados aquí, un `INSERT` hecho por un rol no-owner (`authenticated`) contra cualquier tabla con RLS habilitado que tenga **cualquier** foreign key falla con `"new row violates row-level security policy"` — confirmado en dos proyectos Supabase distintos, con políticas `with check (true)`, con FK a tablas sin RLS, y hasta con el valor de la FK en `NULL`. `UPDATE`/`DELETE`/`SELECT` no están afectados, solo `INSERT`. La solución usada: funciones `SECURITY DEFINER` (`create_project`, `invite_project_member`, `create_column`, `create_task`, `start_task_timer`) que hacen el `INSERT` como owner y validan permisos manualmente dentro de la función. **Cualquier tabla nueva con FK que el cliente necesite insertar directamente necesita el mismo patrón de RPC**, no un insert directo desde `src/features/*/api.ts`.
- **Tablas con Realtime necesitan `REPLICA IDENTITY FULL`**: sin esto, los eventos `DELETE` de Postgres solo incluyen la primary key (no `project_id` ni ninguna otra columna), así que un `filter: project_id=eq.X` en un canal de Supabase Realtime nunca hace match en un DELETE y el evento no llega — se pierde silenciosamente, sin error visible. Toda tabla añadida a `supabase_realtime` con un filtro por columna (no solo por PK) necesita `alter table ... replica identity full;` (ver migración `realtime_replica_identity.sql`). Además, las tablas creadas por migración SQL no se agregan automáticamente a la publicación `supabase_realtime` (a diferencia de las creadas desde el dashboard) — hace falta `alter publication supabase_realtime add table ...` explícito.

- **Post-MVP: detalle de tarea extendido (Fase 7)**: `tasks` ganó `priority` (`low`/`medium`/`high`, nullable), `due_date`. `assigned_to` (single) se reemplazó por `task_assignees` (many-to-many — una tarea puede compartirse con varias personas). `tags`/`task_tags` son categorías creadas por el usuario, por proyecto. Sigue el mismo patrón RPC para INSERT (`create_tag`, `add_task_tag`, `add_task_assignee`); `UPDATE`/`DELETE` van directo.
- **Post-MVP: comentarios por tarea (Fase 8)**: tabla `comments` (denormaliza `project_id` vía trigger, mismo patrón que `columns`/`tasks`), RPC `create_comment` para el INSERT, `DELETE` solo permitido al autor del comentario (política RLS `user_id = auth.uid()`, no todo miembro del proyecto). Suscrita a Realtime igual que el resto del kanban.
- **Post-MVP: vistas List/Timeline (Fase 9)**: `TaskBoardArea` es el wrapper que decide qué vista renderizar (Board/List/Timeline) y es dueño del estado del modal de detalle (antes vivía dentro de `KanbanBoard`) — las tres vistas comparten el mismo `TaskDetailModal`. **Timeline es de solo lectura**: no es un Gantt con arrastrar-para-reprogramar, es una fila horizontal de los próximos 14 días (+ columna "Sin fecha") mostrando qué tareas vencen cuándo; para cambiar la fecha se abre el modal, igual que las otras vistas. Se decidió así explícitamente para no construir un Gantt completo sin que aporte valor claro todavía. Roadmap post-MVP acordado con el usuario: Fase 7 → Fase 8 → Fase 9 (esto) → Fase 10 Equipos (ver abajo).
- **Equipos (planeado, Fase 10)**: modelo tipo "grupo de WhatsApp" — alguien crea un equipo, invita gente al equipo (no a un proyecto), los miembros ven qué proyectos existen pero NO tienen acceso hasta que el admin se lo asigna explícitamente (reutilizando `project_members`, pero solo entre gente que ya es del equipo). Restricción importante todavía sin implementar: **solo el admin del equipo puede ver cuánto ha trabajado cada miembro** — esto requiere cambiar la política RLS de `time_sessions` (hoy cualquier miembro del proyecto ve las sesiones de todos); un miembro normal debe ver únicamente sus propias sesiones.

## Reglas de trabajo en este proyecto
- No introducir integraciones externas, app móvil ni facturación sin confirmación explícita del usuario (están fuera del MVP).
- No construir sync/local-first todavía — la arquitectura cloud-first no debe complicarse con una capa de sincronización offline no solicitada.
- Cambios en el esquema de la base de datos (Supabase/Postgres) y en las políticas de RLS se explican antes de aplicarse, dado que afectan datos compartidos entre miembros de un proyecto.
- Mantener el kanban y el timer como los dos núcleos del producto: cualquier feature nueva se evalúa contra si refuerza o distrae de esos dos flujos.
- Toda UI nueva parte de los tokens del [sistema de diseño](#sistema-de-diseño) (fondo negro, primario `#EB3619`). No introducir colores, radios o fuentes fuera de esa paleta sin confirmarlo antes.
- **Los tests e2e (`e2e/`, Playwright) corren contra el Supabase real**, no un mock: cada test crea una cuenta (`noemipuertor+e2e-*@gmail.com`) y datos propios. No hay limpieza automática de usuarios de auth (necesitaría la service role key, que este proyecto no maneja) — solo los proyectos/tareas quedan limpiables vía RLS normal. Aceptado como límite conocido dado el tamaño del proyecto; si el volumen de cuentas de prueba se vuelve un problema, resolverlo con un cron de limpieza usando la service role key, no manejándola desde el cliente.
- **Errores de mutaciones se muestran solos**: el `MutationCache` global en `queryClient.ts` empuja cualquier error de mutación no capturado a un toast (`useToastStore`). Una mutación que ya maneja su propio error inline (ej. `useInviteMember`) debe marcar `meta: { suppressToast: true }` para no duplicar el aviso.
