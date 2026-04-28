/**
 * PLANET-1260 / PLANET-1342 — Reusable image uploader component
 *
 * Drag & drop / click to upload. Reads file as base64 data URL
 * and passes it directly to onChange (no external storage needed).
 */
import { useCallback, useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

export default function ImageUploader({ value, onChange, className }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setError('图片不能超过 4MB');
        return;
      }
      setError(null);
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError('读取图片失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDelete = useCallback(() => {
    onChange('');
    setError(null);
  }, [onChange]);

  // Show preview if we have a URL
  if (value && !isUploading) {
    return (
      <div className={`relative group rounded-md border border-border bg-muted/30 p-2 ${className || ''}`}>
        <img
          src={value}
          alt="uploaded"
          className="max-h-32 rounded object-contain mx-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-1 right-1 p-1 rounded-md bg-background/80 border border-border text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={className || ''}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed
          cursor-pointer transition-colors py-4 px-3
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
          ${isUploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">上传中...</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">点击或拖拽上传图片</span>
            <span className="text-[10px] text-muted-foreground/60">最大 4MB · JPG / PNG / WebP</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
