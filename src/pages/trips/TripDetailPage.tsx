import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Folder, 
  Search, 
  MoreVertical, 
  LayoutGrid, 
  List as ListIcon, 
  ChevronRight, 
  Info, 
  Download, 
  Sparkles,
  Loader2,
  ArrowLeft,
  Globe,
  MapPin,
  Upload,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// Services & Types
import { tripService } from "@/services/tripService";
import { directoryService } from "@/services/directoryService";
import { storageService } from "@/services/storageService";
import { FileThumbnail } from "@/components/drive/FileThumbnail";
import type { Trip } from "@/types/trips";
import type { DirectoryItem } from "@/types/drive";

export const TripDetailPage = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  
  // Data State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  
  // UI State
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string, progress: number } | null>(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const tripData = await tripService.fetchTripById(tripId);
      setTrip(tripData);
      
      if (tripData.directoryId) {
        const contents = await directoryService.fetchContents(tripData.directoryId);
        const combinedItems: DirectoryItem[] = [
          ...(contents.children || []).map(child => ({ ...child, type: 'directory' as const })),
          ...(contents.files || []).map(file => ({ ...file, type: 'file' as const }))
        ];
        setItems(combinedItems);
      }
    } catch (err) {
      console.error("Failed to fetch trip details:", err);
      setError("Failed to load trip details");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyze = async () => {
    if (!tripId || analyzing) return;
    setAnalyzing(true);
    try {
      await tripService.analyzeTrip(Number(tripId));
      // Give feedback
      setTimeout(() => setAnalyzing(false), 2000);
    } catch (err) {
      console.error("Analysis failed", err);
      setAnalyzing(false);
    }
  };

  const handleDownload = async (item: DirectoryItem) => {
    if (item.type !== 'file') return;
    try {
      const blob = await storageService.downloadFile(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download file");
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !trip?.directoryId) return;

    const filesArray = Array.from(selectedFiles);
    setError(null);

    try {
      const onProgress = (percent: number) => {
        setUploadProgress({ 
          fileName: filesArray.length === 1 ? filesArray[0].name : `${filesArray.length} files`, 
          progress: percent 
        });
      };

      if (filesArray.length === 1) {
        await storageService.uploadFile(filesArray[0], trip.directoryId, onProgress);
      } else {
        await storageService.uploadFilesBatch(filesArray, trip.directoryId, onProgress);
      }
      setIsFabOpen(false);
      fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Upload failed");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredItems = useMemo(() => items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [items, searchQuery]);

  if (loading && !trip) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-12 w-48 bg-white/5 rounded-xl" />
        <Skeleton className="h-48 w-full bg-white/5 rounded-[2rem]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="aspect-square bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/trips")}
            className="h-10 w-10 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-500">
            <span>Trips</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{trip?.title}</span>
          </div>
        </div>

        <div className="flex items-center p-0.5 bg-white/5 rounded-lg border border-white/5">
          <Button 
            variant="ghost" 
            size="sm"
            className={cn(
              "h-7 px-3 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
              view === 'grid' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )} 
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="h-3 w-3 mr-1.5" />
            Grid
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className={cn(
              "h-7 px-3 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
              view === 'list' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )} 
            onClick={() => setView('list')}
          >
            <ListIcon className="h-3 w-3 mr-1.5" />
            List
          </Button>
        </div>
      </div>

      {/* Hero / Info Card */}
      <Card className="relative overflow-hidden bg-[#0a0a0a]/50 border-white/5 backdrop-blur-xl rounded-[2.5rem] p-8">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Globe className="h-32 w-32 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-white">{trip?.title}</h1>
              <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px] font-black tracking-widest px-3 py-1 rounded-full">
                {trip?.status}
              </Badge>
            </div>
            <p className="text-zinc-400 max-w-2xl leading-relaxed">
              {trip?.description || "Capture every moment of your journey. Explore the media, locations, and insights gathered during this trip."}
            </p>
            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                <span>{trip?.visibility} Trip</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>Trip Assets Folder</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAnalyze}
            disabled={analyzing}
            className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all active:scale-95 gap-2 shrink-0"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "Analyzing..." : "Analyze Trip"}
          </Button>
        </div>
      </Card>

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
          <input 
            placeholder="Search trip assets..." 
            className="w-full bg-white/5 border border-white/10 pl-10 pr-4 h-11 text-sm focus:outline-none focus:border-primary/50 transition-all rounded-xl text-white placeholder:text-zinc-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Items Display */}
      <div className="px-1 min-h-[400px]">
        {loading ? (
          <div className={cn(
            "grid gap-4",
            view === 'grid' ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"
          )}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className={cn("bg-white/5 rounded-xl", view === 'grid' ? "aspect-square" : "h-14")} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
            <Folder className="h-12 w-12 text-zinc-600 mb-4 stroke-1" />
            <p className="text-sm font-medium text-zinc-500">No media found for this trip yet</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            view === 'grid' ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  layout
                >
                  <Card 
                    className={cn(
                      "group relative border-white/5 bg-white/5 transition-all duration-300 hover:bg-white/10 cursor-pointer overflow-hidden rounded-2xl flex",
                      view === 'grid' ? "flex-col" : "p-2 px-4 items-center justify-between h-16"
                    )}
                  >
                    <div className={cn("flex items-center gap-3 min-w-0", view === 'grid' ? "flex-col w-full" : "flex-row")}>
                      <FileThumbnail 
                        fileId={item.id} 
                        type={item.type} 
                        className={view === 'grid' ? "aspect-square w-full" : "h-12 w-12 shrink-0"}
                      />
                      <div className={cn("overflow-hidden w-full", view === 'grid' ? "p-3" : "")}>
                        <p className="truncate text-xs font-bold text-white group-hover:text-primary transition-colors">
                          {item.name}
                        </p>
                        <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-0.5">
                          {item.type}
                        </p>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      view === 'grid' ? "absolute top-2 right-2" : "relative"
                    )}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-primary hover:border-primary transition-all"
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Upload Button (FAB) */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-4 z-50">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="flex flex-col items-end gap-3 mb-2"
            >
              <div className="group relative flex items-center gap-3">
                <span className="opacity-0 group-hover:opacity-100 transition-all absolute right-16 whitespace-nowrap rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl border border-white/10 shadow-2xl translate-x-2 group-hover:translate-x-0">
                  Upload File
                </span>
                <Button 
                  size="icon" 
                  className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 text-primary hover:bg-white/10 hover:border-primary/50 shadow-2xl transition-all hover:scale-110 active:scale-95"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button 
          className={cn(
            "h-16 w-16 rounded-[1.5rem] bg-primary hover:bg-primary/90 text-white shadow-[0_20px_50px_rgba(170,59,255,0.4)] transition-all duration-500 hover:scale-110 active:scale-95",
            isFabOpen && "rotate-[135deg] bg-zinc-800 shadow-none"
          )}
          onClick={() => setIsFabOpen(!isFabOpen)}
        >
          <Plus className="h-8 w-8" strokeWidth={2.5} />
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          onChange={onFileUpload} 
        />
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <Info className="h-4 w-4" />
            <span className="text-xs font-bold">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 p-0 hover:bg-white/10 rounded-full ml-2">×</Button>
          </motion.div>
        )}

        {uploadProgress && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-32 w-80 bg-[#0a0810]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl z-[9999]"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] font-bold text-white truncate">
                      Uploading {uploadProgress.fileName}
                    </span>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      {uploadProgress.progress}% complete
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${uploadProgress.progress}%` }} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
