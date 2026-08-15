import { DownloadIcon, PaperclipIcon, TrashIcon } from "../../components/icons";
import { useAuth } from "../auth/AuthProvider";
import { getAttachmentDownloadUrl } from "./attachments";
import { formatBytes } from "./attachmentUtils";
import { useDeleteAttachment, useProjectAttachments } from "./hooks";

export function FilesView({
  projectId,
  onOpenTask,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
}) {
  const { user } = useAuth();
  const { data: attachments, isLoading } = useProjectAttachments(projectId);
  const deleteAttachment = useDeleteAttachment(null, projectId);

  async function handleDownload(storagePath: string) {
    // Open the tab synchronously (inside the click handler) so browsers don't
    // block it as a popup — window.open() after an await loses the
    // user-gesture context and gets blocked silently.
    const tab = window.open("", "_blank");
    try {
      const url = await getAttachmentDownloadUrl(storagePath);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch {
      tab?.close();
    }
  }

  if (isLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando archivos...</p>;
  }

  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Todavía no hay archivos. Adjúntalos desde el detalle de una tarea.
      </p>
    );
  }

  return (
    <div className="flex flex-col rounded-md overflow-hidden border border-outline-variant/20">
      {attachments.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-lowest hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-b-0"
        >
          <PaperclipIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface truncate">{a.filename}</p>
            <button
              type="button"
              onClick={() => onOpenTask(a.task_id)}
              className="text-xs text-on-surface-variant hover:text-primary hover:underline truncate"
            >
              {a.task_title}
            </button>
          </div>
          <span className="text-xs text-on-surface-variant shrink-0 hidden sm:block">
            {formatBytes(a.size_bytes)}
          </span>
          <span className="text-xs text-on-surface-variant shrink-0 hidden md:block">
            {a.uploader.display_name}
          </span>
          <span className="text-xs text-on-surface-variant shrink-0">
            {new Date(a.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
          </span>
          <button
            type="button"
            onClick={() => handleDownload(a.storage_path)}
            aria-label={`Descargar ${a.filename}`}
            className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
          {a.uploaded_by === user?.id && (
            <button
              type="button"
              onClick={() => deleteAttachment.mutate({ attachmentId: a.id, storagePath: a.storage_path })}
              aria-label={`Eliminar ${a.filename}`}
              className="text-outline hover:text-error transition-colors shrink-0"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
