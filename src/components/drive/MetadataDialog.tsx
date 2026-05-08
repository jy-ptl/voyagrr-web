import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, File, ChevronDown, ChevronUp } from "lucide-react";

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
      <DialogContent className="sm:max-w-[480px] bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-[2.5rem] p-0 shadow-2xl border-t-white/10">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <DialogHeader className="p-6 pb-2 relative z-10">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden">
              {item.type === 'directory' ? 
                <Folder className="h-5 w-5 text-zinc-400" strokeWidth={1.5} /> : 
                <File className="h-5 w-5 text-zinc-400" strokeWidth={1.5} />
              }
            </div>
            <div className="space-y-0.5 px-4">
              <DialogTitle className="text-lg font-bold tracking-tight text-white truncate max-w-[280px]">
                {item.name}
              </DialogTitle>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                {item.type === 'directory' ? 'Collection' : metadata?.file?.mime || 'Binary File'}
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-6 pt-2 space-y-5 relative z-10 max-h-[55vh] overflow-y-auto custom-scrollbar">
          {/* AI Intelligence Bento */}
          {metadata?.analysis?.scene && (
            <div className="relative group overflow-hidden rounded-[1.5rem] bg-white/5 border border-white/5 p-6 transition-all hover:border-white/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">AI Prediction</p>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-black text-white capitalize tracking-tighter">
                  {metadata.analysis.scene}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-zinc-700" />
                  <p className="text-[10px] font-bold text-zinc-600">Verified Intelligence</p>
                </div>
              </div>
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

          {/* Expandable Semantic Tags */}
          {tags.length > 0 && (
            <div className="space-y-2.5 px-1">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600">Key Identifiers</p>
                <div className="h-px flex-1 bg-white/5 ml-3" />
              </div>
              <div className="flex flex-wrap gap-1.5 transition-all duration-500">
                {visibleTags.map((t: { tag: string }, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-zinc-400 text-[9px] font-bold uppercase tracking-tight hover:text-white hover:border-white/20 transition-all">
                    {t.tag}
                  </span>
                ))}
                {hasMoreTags && !showAllTags && (
                  <button 
                    onClick={() => setShowAllTags(true)}
                    className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold uppercase tracking-tight hover:bg-primary/20 transition-all flex items-center gap-1"
                  >
                    <span>+{tags.length - 4} More</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                )}
                {showAllTags && hasMoreTags && (
                  <button 
                    onClick={() => setShowAllTags(false)}
                    className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-zinc-500 text-[9px] font-bold uppercase tracking-tight hover:text-white transition-all flex items-center gap-1"
                  >
                    <span>Show Less</span>
                    <ChevronUp className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3 relative z-10">
          <Button 
            className="flex-1 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
