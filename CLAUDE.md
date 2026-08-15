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

## Sistema de diseño (fuente: Stitch)

Fuente: [Stitch project 2566146179284865822](https://stitch.withgoogle.com/projects/2566146179284865822), pantallas "TimeDesk - Project Kanban", "TimeDesk - Dashboard".

El proyecto de Stitch contiene 3 exploraciones visuales distintas. Solo una es el sistema de diseño real del producto — las otras dos quedan descartadas para la implementación:

- **✅ Usar — "Mi sistema de diseño"** (modo claro) + **"Stone & Sage"** (modo oscuro): mismo color de marca base (`#859c71`, verde salvia), uno en `colorMode: LIGHT` y otro en `colorMode: DARK`. Es el único de los tres con un documento de diseño escrito específicamente para TimeDesk ("calm, focused, grounded"; Display = Timer, Heading = Secciones, Body = Tareas). Las pantallas "Project Kanban (Light Mode) - Correct Sidebar Selection" y "Dark Mode - Timer Active Only" usan estos tokens.
- **❌ Descartar — "Graphite Draft" / "The Living Blueprint"**: paleta monocromática tipo boceto de arquitecto, usada solo en las pantallas "Dashboard Wireframe" y "Dashboard - Kanban View". Su propio doc de diseño la describe como fase conceptual/wireframe, no como piel final.

**Inconsistencia detectada y resuelta**: "Mi sistema de diseño" especifica tipografía **Inter**; "Stone & Sage" (su contraparte oscura) especifica **Manrope**. Para mantener una sola identidad tipográfica entre modo claro y oscuro, se usa **Inter** en ambos. Los valores de `border-radius` del HTML autogenerado por Stitch (`0.125rem` a `0.75rem`, con `rounded-full` que no produce círculos reales) no coinciden con la escala documentada en el design doc; se usa la escala documentada, más consistente:

| Token | Valor |
|---|---|
| `radius.sm` | 6px (inputs, controles pequeños) |
| `radius.md` | 10px (cards, contenedores) |
| `radius.lg` | 16px (secciones principales) |
| `radius.full` | 9999px (pills, tags, botones circulares del timer) |

### Tokens de color

| Token | Claro | Oscuro |
|---|---|---|
| `background` / `surface` | `#fef9ed` | `#111410` |
| `surface-container-lowest` | `#ffffff` | `#0c0f0b` |
| `surface-container-low` | `#f8f3e7` | `#191c18` |
| `surface-container` | `#f3ede1` | `#1d201c` |
| `surface-container-high` | `#ede8dc` | `#282b26` |
| `surface-container-highest` | `#e7e2d6` | `#333630` |
| `on-background` / `on-surface` | `#1d1c14` | `#e1e3db` |
| `on-surface-variant` | `#44483f` | `#c4c8bc` |
| `outline` | `#75786e` | `#8e9287` |
| `outline-variant` | `#c4c8bc` | `#44483f` |
| `primary` | `#4f653e` | `#b6cea0` |
| `primary-container` | `#859c71` | `#859c71` |
| `on-primary` | `#ffffff` | `#223514` |
| `secondary` | `#556344` | `#c0cab3` |
| `secondary-container` | `#d5e5be` | `#434c3b` |
| `error` | `#ba1a1a` | `#ffb4ab` |

### Principios de UI (heredados del design doc)
- Diseño plano por defecto: sin sombras pesadas, separación por contraste tonal entre superficies (`surface` → `surface-container` → `surface-container-high`), no por líneas divisorias.
- Jerarquía tipográfica: Display grande para el timer activo, Heading para secciones, Body para tareas, Caption para metadatos.
- Una sola acción primaria dominante por vista (botón `primary-container` sólido); acciones secundarias en outline/ghost.
- Layout base validado en las pantallas: sidebar fijo de navegación (Timer/Tasks/Analytics/Settings), header superior con búsqueda, sección "bento" del timer activo + tarjetas de stats, y kanban de 3 columnas (To Do / In Progress / Done) debajo — coherente con las columnas personalizables por proyecto definidas en la arquitectura.

## Stack tecnológico

| Capa | Elección | Motivo |
|---|---|---|
| Shell de escritorio | **Tauri** (Rust) | Binarios livianos, bajo consumo de memoria, mejor para una app que corre en segundo plano/bandeja del sistema que Electron. |
| Frontend | **React + TypeScript + Vite** | Ecosistema maduro, tipado fuerte, DX rápida. |
| Estilos/UI | **Tailwind CSS + shadcn/ui**, tokens y tipografía **Inter** según el [sistema de diseño](#sistema-de-diseño-fuente-stitch) de Stitch | Componentes accesibles y personalizables; paleta y radios ya validados en las pantallas de Stitch, no se diseña de cero. |
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
- **INSERT en tablas con foreign keys pasa por RPC, no por `supabase.from(...).insert(...)` directo**: en el/los proyecto(s) de Supabase usados aquí, un `INSERT` hecho por un rol no-owner (`authenticated`) contra cualquier tabla con RLS habilitado que tenga **cualquier** foreign key falla con `"new row violates row-level security policy"` — confirmado en dos proyectos Supabase distintos, con políticas `with check (true)`, con FK a tablas sin RLS, y hasta con el valor de la FK en `NULL`. `UPDATE`/`DELETE`/`SELECT` no están afectados, solo `INSERT`. La solución usada: funciones `SECURITY DEFINER` (`create_project`, `invite_project_member`, `create_column`, `create_task` en la migración `rpc_writes.sql`) que hacen el `INSERT` como owner y validan permisos manualmente dentro de la función. **Cualquier tabla nueva con FK que el cliente necesite insertar directamente (ej. `time_sessions` en la Fase 3) necesita el mismo patrón de RPC**, no un insert directo desde `src/features/*/api.ts`.

## Reglas de trabajo en este proyecto
- No introducir integraciones externas, app móvil ni facturación sin confirmación explícita del usuario (están fuera del MVP).
- No construir sync/local-first todavía — la arquitectura cloud-first no debe complicarse con una capa de sincronización offline no solicitada.
- Cambios en el esquema de la base de datos (Supabase/Postgres) y en las políticas de RLS se explican antes de aplicarse, dado que afectan datos compartidos entre miembros de un proyecto.
- Mantener el kanban y el timer como los dos núcleos del producto: cualquier feature nueva se evalúa contra si refuerza o distrae de esos dos flujos.
- Toda UI nueva parte de los tokens y layouts del [sistema de diseño](#sistema-de-diseño-fuente-stitch) (Stitch, variante "Mi sistema de diseño" / "Stone & Sage"). No introducir colores, radios o fuentes fuera de esa paleta sin confirmarlo antes; no usar la piel "Graphite Draft" (descartada).
