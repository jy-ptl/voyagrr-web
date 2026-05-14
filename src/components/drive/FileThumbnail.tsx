import { useState, useEffect } from "react";
import { File, Folder, Image as ImageIcon } from "lucide-react";
import { storageService } from "@/services/storageService";
import { cn } from "@/lib/utils";

interface FileThumbnailProps {
  fileId: string | number;
  type: 'directory' | 'file';
  className?: string;
  iconClassName?: string;
}

// Simple in-memory cache and request deduplication
const thumbnailCache = new Map<string | number, string>();
const pendingRequests = new Map<string | number, Promise<string>>();

export const FileThumbnail = ({ fileId, type, className, iconClassName }: FileThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(type === 'file' ? thumbnailCache.get(fileId) || null : null);
  const [loading, setLoading] = useState(type === 'file' && !thumbnailCache.has(fileId));
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (type === 'file') {
      const cachedUrl = thumbnailCache.get(fileId) ?? null;

      if (cachedUrl) {
        queueMicrotask(() => {
          if (!isMounted) return;
          setThumbnailUrl(cachedUrl);
          setLoading(false);
          setError(false);
        });

        return () => {
          isMounted = false;
        };
      }

      const fetchThumbnail = async () => {
        try {
          let request = pendingRequests.get(fileId);
          
          if (!request) {
            request = (async () => {
              const blob = await storageService.getThumbnail(fileId);
              const url = URL.createObjectURL(blob);
              thumbnailCache.set(fileId, url);
              return url;
            })();
            pendingRequests.set(fileId, request);
          }

          const url = await request;
          if (isMounted) {
            setThumbnailUrl(url);
            setError(false);
          }
        } catch (err) {
          console.warn(`Failed to load thumbnail for file ${fileId}`, err);
          if (isMounted) setError(true);
        } finally {
          if (isMounted) {
            setLoading(false);
            pendingRequests.delete(fileId);
          }
        }
      };

      fetchThumbnail();
    }

    return () => {
      isMounted = false;
      // Note: We don't revokeObjectURL here because it's cached globally
      // and might be used by other components. In a large app, we'd need
      // a more sophisticated cache eviction strategy.
    };
  }, [fileId, type]);

  if (type === 'directory') {
    return (
      <div className={cn("bg-primary/10 text-primary flex items-center justify-center rounded-lg transition-all duration-300", className)}>
        <Folder className={cn("h-8 w-8", iconClassName)} strokeWidth={1.5} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("bg-zinc-800 animate-pulse flex items-center justify-center rounded-lg", className)}>
        <ImageIcon className={cn("h-6 w-6 text-zinc-600", iconClassName)} strokeWidth={1.5} />
      </div>
    );
  }

  if (error || !thumbnailUrl) {
    return (
      <div className={cn("bg-zinc-800 text-zinc-500 flex items-center justify-center rounded-lg group-hover:bg-zinc-700 group-hover:text-white transition-all duration-300", className)}>
        <File className={cn("h-8 w-8", iconClassName)} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-zinc-900 border border-white/5", className)}>
      <img 
        src={thumbnailUrl} 
        alt="File thumbnail" 
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </div>
  );
};
