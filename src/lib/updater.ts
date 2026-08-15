import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type PendingUpdate = {
  version: string;
  body: string | null;
  install: () => Promise<void>;
};

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

  return {
    version: update.version,
    body: update.body ?? null,
    install: async () => {
      await update.downloadAndInstall();
      await relaunch();
    },
  };
}
