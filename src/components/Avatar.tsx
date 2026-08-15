import { useRef, useState } from "react";
import { CameraIcon } from "./icons";

export function Avatar({
  url,
  name,
  size = "w-8 h-8",
  textSize = "text-xs",
}: {
  url: string | null | undefined;
  name: string;
  size?: string;
  textSize?: string;
}) {
  if (url) {
    return <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span
      className={`${size} rounded-full bg-secondary-container text-on-surface flex items-center justify-center ${textSize} font-bold shrink-0`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AvatarUpload({
  url,
  name,
  size = "w-16 h-16",
  onUpload,
  onRemove,
}: {
  url: string | null | undefined;
  name: string;
  size?: string;
  onUpload: (file: File) => Promise<unknown>;
  onRemove?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0">
        <Avatar url={url} name={name} size={size} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Cambiar foto"
          title="Cambiar foto"
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center border-2 border-surface-container hover:bg-primary transition-colors disabled:opacity-50"
        >
          <CameraIcon className="w-2.5 h-2.5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
      </div>
      {url && onRemove && (
        <button type="button" onClick={onRemove} className="text-[10px] text-on-surface-variant hover:text-error">
          Quitar foto
        </button>
      )}
      {error && <p className="text-error text-[10px] text-center max-w-[120px]">{error}</p>}
    </div>
  );
}
