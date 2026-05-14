import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MetadataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    name: string;
    type: 'directory' | 'file';
  } | null;
  metadata: {
    file?: {
      size?: number;
      width?: number;
      height?: number;
      mime?: string;
    };
    analysis?: {
      scene?: string;
      tags?: Array<{ tag: string }>;
    };
  } | null;
}

export const MetadataDialog = ({ isOpen, onClose, item, metadata }: MetadataDialogProps) => {
  const [showAllTags, setShowAllTags] = useState(false);

  if (!item) return null;

  const fileSize = (() => {
    const bytes = metadata?.file?.size;
    if (!bytes) return '---';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  })();

  const resolution = metadata?.file?.width 
    ? `${metadata.file.width}×${metadata.file.height}` 
    : 'Vector';

  const tags = metadata?.analysis?.tags || [];
  const visibleTags = showAllTags ? tags : tags.slice(0, 4);
  const hasMoreTags = tags.length > 4;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="truncate">{item.name}</DialogTitle>
          <DialogDescription>
            {item.type === "directory" ? "Folder details" : metadata?.file?.mime || "File details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</p>
              <p className="mt-1 text-sm font-medium">{item.type === "directory" ? "Folder" : "File"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Size</p>
              <p className="mt-1 text-sm font-medium">{fileSize}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resolution</p>
            <p className="mt-1 text-sm font-medium">{resolution}</p>
          </div>

          {metadata?.analysis?.scene && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Prediction</p>
              <p className="mt-1 text-base font-semibold capitalize">{metadata.analysis.scene}</p>
            </div>
          )}

          {tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Key Identifiers</p>
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((t: { tag: string }, i: number) => (
                  <span key={i} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tight">
                    {t.tag}
                  </span>
                ))}
                {hasMoreTags && !showAllTags && (
                  <button onClick={() => setShowAllTags(true)} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tight text-primary">
                    +{tags.length - 4} More
                  </button>
                )}
                {showAllTags && hasMoreTags && (
                  <button onClick={() => setShowAllTags(false)} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
                    Show Less
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
