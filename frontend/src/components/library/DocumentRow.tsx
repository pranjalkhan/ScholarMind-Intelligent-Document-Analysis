import React, { useState } from "react";
import { FileText, RefreshCw, Trash2, X } from "lucide-react";
import { DocumentItem } from "../../api";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { StatusPill } from "../ui/StatusPill";

interface DocumentRowProps {
  document: DocumentItem;
  index: number;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** One library entry: metadata, indexing state and destructive actions. */
export function DocumentRow({ document, index, onDelete, onRetry }: DocumentRowProps) {
  const [confirming, setConfirming] = useState(false);
  const pending = !["completed", "failed"].includes(document.status);

  return (
    <Panel interactive className="animate-fade-up" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--color-line)] bg-[rgba(15,24,35,0.9)] text-slate-400">
          <FileText className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{document.filename}</span>
            <StatusPill status={document.status} />
          </div>
          <div className="mono-num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>{formatBytes(document.file_size_bytes)}</span>
            <span>{document.page_count} pages</span>
            <span>{document.chunk_count} chunks</span>
            {document.ocr_pages > 0 && <span>{document.ocr_pages} OCR</span>}
            <span className="uppercase tracking-wider">{document.category}</span>
          </div>

          {pending && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(27,42,60,0.9)]">
              <div
                className="h-full w-2/5 rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#34d399]"
                style={{ animation: "sweep 1.8s ease-in-out infinite" }}
              />
            </div>
          )}

          {document.error_message && (
            <p className="mt-1.5 text-[11px] text-[color:var(--color-alert)]">
              {document.error_message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {document.status === "failed" && (
            <Button
              size="sm"
              iconOnly
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => onRetry(document.id)}
              title="Retry processing"
              className="text-[color:var(--color-gold)]"
            />
          )}
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onDelete(document.id);
                  setConfirming(false);
                }}
              >
                Delete
              </Button>
              <Button
                size="sm"
                iconOnly
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => setConfirming(false)}
                title="Cancel"
              />
            </>
          ) : (
            <Button
              size="sm"
              iconOnly
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setConfirming(true)}
              title="Delete document"
              className="hover:text-[color:var(--color-alert)]"
            />
          )}
        </div>
      </div>
    </Panel>
  );
}
