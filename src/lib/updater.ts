import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type PendingUpdate = {
  /** Versión que ya está instalada, según el propio binario. */
  currentVersion: string;
  version: string;
  body: string | null;
  install: () => Promise<void>;
};

type Parsed = { core: number[]; prerelease: string | null };

function parseVersion(raw: string): Parsed | null {
  // Tolera un "v" delante por si el feed lo trae; el resto tiene que ser semver.
  const cleaned = raw.trim().replace(/^v/i, "");
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(cleaned);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

/**
 * ¿`remote` es estrictamente mayor que `current`?
 *
 * El plugin ya hace esta comparación del lado de Rust, pero la repetimos acá
 * por dos motivos: deja el criterio a la vista (era imposible saber qué estaba
 * comparando cuando aparecía un aviso indeseado) y protege del caso en que el
 * feed sirva una versión igual o anterior — por ejemplo si se vuelve a publicar
 * un release viejo, que pasaría a ser el `latest` del endpoint.
 */
export function isNewerVersion(remote: string, current: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  // Si alguna no se puede interpretar, no inventamos: no hay actualización.
  if (!a || !b) return false;

  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  // Mismo x.y.z: una prerelease (1.0.0-beta) es ANTERIOR a la final (1.0.0).
  if (a.prerelease && !b.prerelease) return false;
  if (!a.prerelease && b.prerelease) return true;
  return false;
}

/** No-ops outside the packaged Tauri app (e.g. the browser dev preview). */
export async function checkForUpdate(): Promise<PendingUpdate | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;

  let update: Update | null;
  try {
    update = await check();
  } catch {
    // Offline, no network, or the release feed isn't reachable — treat as "no update".
    return null;
  }
  if (!update) return null;

  if (!isNewerVersion(update.version, update.currentVersion)) return null;

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    body: update.body ?? null,
    install: async () => {
      await update.downloadAndInstall();
      await relaunch();
    },
  };
}
