'use client';

import { useCallback, useRef } from 'react';
import { FileText, Upload } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  onView?: (file: File) => void;
  accept?: string;
  maxBytes?: number;
  file?: File | null;
  error?: string;
}

export function FileDropzone({
  onFile,
  onView,
  accept = '.pdf',
  maxBytes = 10 * 1024 * 1024,
  file,
  error,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFile(selected);
  };

  return (
    <div>
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          'rounded-[10px] border border-dashed p-3 flex items-center gap-3',
          file ? 'border-jobs-border-strong' : 'border-jobs-border-strong cursor-pointer hover:border-gold-300/50',
          error && 'border-crit/50',
        )}
      >
        {file ? (
          <>
            <FileText className="w-4 h-4 shrink-0 text-gold-500" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-medium text-jobs-ink truncate">{file.name}</p>
              <p className="text-[11.5px] text-jobs-ink-muted">{formatBytes(file.size)}</p>
            </div>
            {onView && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onView(file); }}
                className="shrink-0 text-[12.5px] font-medium text-gold-500 hover:text-gold-400"
              >
                View
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="shrink-0 inline-flex items-center gap-1 rounded-[8px] border border-jobs-border px-2.5 py-1.5 text-[12.5px] font-medium text-jobs-ink-secondary hover:border-jobs-border-strong transition-colors"
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.8} />
              Replace
            </button>
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 shrink-0 text-jobs-ink-muted" strokeWidth={1.8} />
            <p className="flex-1 text-[13.5px] text-jobs-ink-secondary">
              Drop your CV here, or <span className="text-gold-500 font-semibold">browse</span>
              <span className="block text-[11.5px] text-jobs-ink-muted">PDF · Max {formatBytes(maxBytes)}</span>
            </p>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-crit">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
