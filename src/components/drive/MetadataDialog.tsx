import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, File, ChevronDown, ChevronUp, Smartphone, Calendar, MapPin, Users, Smile, Activity } from "lucide-react";
import type { FileMetadata } from "@/types/drive";

interface MetadataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    name: string;
    type: 'directory' | 'file';
  } | null;
  metadata: FileMetadata | null;
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

  const faces = metadata?.recognition?.faces || [];

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

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-0.5 transition-all">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">File Size</p>
              <p className="text-base font-bold text-zinc-300">{fileSize}</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-0.5 transition-all">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Resolution</p>
              <p className="text-base font-bold text-zinc-300">{resolution}</p>
            </div>
          </div>

          {/* Recognition & Device Section */}
          <div className="grid grid-cols-1 gap-3">
            {(metadata?.file?.device || metadata?.file?.updatedOn) && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                {metadata.file.device && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Captured On</p>
                      <p className="text-xs font-bold text-zinc-300">{metadata.file.device}</p>
                    </div>
                  </div>
                )}
                {metadata.file.updatedOn && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Last Modified</p>
                      <p className="text-xs font-bold text-zinc-300">
                        {metadata.file.updatedOn.replace(/:/g, '/').replace(' ', ' at ')}
                      </p>
                    </div>
                  </div>
                )}
                {metadata.file.location && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Location</p>
                      <p className="text-xs font-bold text-zinc-300">{metadata.file.location}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {faces.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Recognized People</p>
                </div>
                <div className="flex flex-col gap-2">
                  {faces.map((face, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 group">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full border flex items-center justify-center text-[10px] font-black group-hover:scale-105 transition-transform",
                          face.user 
                            ? "bg-primary/10 border-primary/20 text-primary" 
                            : "bg-zinc-800 border-white/5 text-zinc-500"
                        )}>
                          {face.user ? `${face.user.firstName[0]}${face.user.lastName[0]}` : "?"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {face.user ? `${face.user.firstName} ${face.user.lastName}` : "Anonymous Face"}
                          </p>
                          <p className="text-[9px] font-medium text-zinc-500">
                            {face.user ? `@${face.user.username}` : `Detection ID: ${i + 1}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">Confidence</p>
                        <p className="text-[10px] font-black text-white/80">
                          {face.confidence ? `${(face.confidence * 100).toFixed(0)}%` : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emotions & Sentiment */}
            {metadata?.analysis?.emotions && metadata.analysis.emotions.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Smile className="h-3.5 w-3.5 text-yellow-500/80" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Emotional Context</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {metadata.analysis.emotions.map((e, i) => (
                    <div key={i} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white capitalize">{e.emotion}</span>
                      <div className="h-1 w-8 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500/50" 
                          style={{ width: `${e.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Object Detection */}
            {metadata?.analysis?.objects && metadata.analysis.objects.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-3.5 w-3.5 text-blue-400" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Visual Entities</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {metadata.analysis.objects.slice(0, 8).map((obj, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-blue-400/5 border border-blue-400/10 text-blue-400/80 text-[9px] font-bold capitalize">
                      {obj.label}
                    </span>
                  ))}
                  {metadata.analysis.objects.length > 8 && (
                    <span className="text-[9px] font-bold text-zinc-600 self-center">
                      +{metadata.analysis.objects.length - 8} others
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Expandable Semantic Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Key Identifiers</p>
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((t: { tag: string; confidence?: number }, i: number) => (
                  <span key={i} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tight flex items-center gap-1.5">
                    {t.tag}
                    {t.confidence && (
                      <span className="text-[7px] text-zinc-600 font-black">
                        {Math.round(t.confidence * 100)}%
                      </span>
                    )}
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
