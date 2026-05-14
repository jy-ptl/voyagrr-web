import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import { 
  ArrowLeft, MapPin, Search, Play, Loader2, Sparkles, X, Smile, Users, Heart, Image as ImageIcon, Upload, Plus, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Services & Types
import { tripService } from "@/services/tripService";
import { directoryService } from "@/services/directoryService";
import { metadataService } from "@/services/metadataService";
import { storageService } from "@/services/storageService";
import { FileThumbnail } from "@/components/drive/FileThumbnail";
import type { Trip } from "@/types/trips";
import type { DirectoryItem, FileMetadata } from "@/types/drive";

// --- Types derived from User Prompt ---
type Location = { lat: number, lon: number };
type Person = { userId: string, firstName: string, username: string, avatarUrl?: string };

type EmotionRecord = {
  emotion: string;
};

type TagRecord = {
  tag: string;
};

type FaceRecord = {
  userId?: string | null;
  user?: {
    firstName: string;
    username: string;
    avatarUrl?: string;
  } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// --- Helpers ---
const extractLocation = (meta: FileMetadata | undefined): Location | null => {
  if (!meta?.file?.location) return null;
  try {
    if (typeof meta.file.location === 'string') {
      const parsed = JSON.parse(meta.file.location);
      if (parsed.lat && parsed.lon) return parsed;
    } else {
      const loc = meta.file.location as unknown;
      if (isRecord(loc) && typeof loc.lat === "number" && typeof loc.lon === "number") {
        return { lat: loc.lat, lon: loc.lon };
      }
    }
  } catch (error) {
    console.warn("Failed to parse trip location", error);
  }
  return null;
};

const extractDate = (meta: FileMetadata | undefined): Date | null => {
  if (!meta?.file?.createdOn) return null;
  try {
    const d = parseISO(meta.file.createdOn.replace(' ', 'T'));
    return isValid(d) ? d : null;
  } catch { return null; }
};

const extractEmotions = (meta: FileMetadata | undefined): string[] => {
  if (!meta?.analysis?.emotions) return [];
  return meta.analysis.emotions.map((emotion: EmotionRecord | string) => typeof emotion === 'string' ? emotion : emotion.emotion).filter(Boolean);
};

const extractTags = (meta: FileMetadata | undefined): string[] => {
  if (!meta?.analysis?.tags) return [];
  return meta.analysis.tags.map((tag: TagRecord) => tag.tag).filter(Boolean);
};

const extractPeople = (meta: FileMetadata | undefined): Person[] => {
  if (!meta?.recognition?.faces) return [];
  const people: Person[] = [];
  meta.recognition.faces.forEach((face: FaceRecord) => {
    if (face.user && face.user.firstName) {
      people.push({
        userId: face.userId || face.user.username,
        firstName: face.user.firstName,
        username: face.user.username,
        avatarUrl: face.user.avatarUrl
      });
    }
  });
  return people;
};

const hasPositiveEmotion = (meta: FileMetadata | undefined): boolean => {
  const emotions = extractEmotions(meta).map(e => e.toLowerCase());
  return emotions.some(e => ['happy', 'joy', 'amazed', 'excited', 'love'].includes(e));
};

const FullQualityImage = ({ fileId, className }: { fileId: string | number, className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;
    
    storageService.downloadFile(fileId).then(blob => {
      if (isMounted) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    }).catch(err => console.error("Failed to fetch full image", err));

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (!url) {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
      </div>
    );
  }
  
  return <img src={url} alt="Full quality" className={cn("h-full w-full object-contain", className)} />;
};

const ReelAutoAdvance = ({
  enabled,
  reelLength,
  onAdvance,
}: {
  enabled: boolean;
  reelLength: number;
  onAdvance: () => void;
}) => {
  useEffect(() => {
    if (!enabled || reelLength < 2) {
      return;
    }

    const timer = window.setTimeout(onAdvance, 4000);
    return () => window.clearTimeout(timer);
  }, [enabled, onAdvance, reelLength]);

  return null;
};

export const TripDetailPage = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  
  // Data State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [metadataMap, setMetadataMap] = useState<Record<string | number, FileMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Upload & FAB State
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string, progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [showHappyMoments, setShowHappyMoments] = useState(false);
  const [selectedScene, setSelectedScene] = useState<string>("All");

  // Reel State
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);

  const refs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const tripData = await tripService.fetchTripById(tripId);
      setTrip(tripData);
      
      const rootDirectoryId = tripData.directoryId;
      if (!rootDirectoryId) {
        setLoading(false);
        return;
      }

      const contents = await directoryService.fetchContents(rootDirectoryId);
      const filesOnly = (contents.files || []).map(file => ({ ...file, type: 'file' as const }));
      setItems(filesOnly);

      try {
        const metaResponses = await metadataService.getDirectoryMetadata(rootDirectoryId);
        const newMap: Record<string | number, FileMetadata> = {};
        metaResponses.forEach((m) => {
          newMap[m.fileId] = m.metadata as FileMetadata;
        });
        setMetadataMap(newMap);
      } catch (mErr) {
        console.warn("Failed to fetch batch metadata", mErr);
      }
    } catch (error) {
      console.error("Failed to fetch trip details:", error);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  const handleAnalyze = async () => {
    if (!tripId || analyzing) return;
    setAnalyzing(true);
    try {
      await tripService.analyzeTrip(Number(tripId));
      setTimeout(() => {
        setAnalyzing(false);
        fetchData();
      }, 2000);
    } catch {
      setAnalyzing(false);
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesArray = Array.from(selectedFiles);
    const oversizedFiles = filesArray.filter(file => file.size > 10 * 1024 * 1024);

    if (oversizedFiles.length > 0) {
      setError(`Some files are too large (max 10MB): ${oversizedFiles.map(f => f.name).join(", ")}`);
      return;
    }

    try {
      const onProgress = (percent: number) => {
        setUploadProgress({ 
          fileName: filesArray.length === 1 ? filesArray[0].name : `${filesArray.length} files`, 
          progress: percent 
        });
      };

      if (filesArray.length === 1) {
        await storageService.uploadFile(filesArray[0], trip?.directoryId ?? null, onProgress);
      } else {
        await storageService.uploadFilesBatch(filesArray, trip?.directoryId ?? null, onProgress);
      }
      setIsFabOpen(false);
      fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Upload failed");
      }
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- Derived Data for Filters ---
  const allPeople = useMemo(() => {
    const map = new Map<string, Person>();
    Object.values(metadataMap).forEach(meta => {
      extractPeople(meta).forEach(p => map.set(p.userId, p));
    });
    return Array.from(map.values());
  }, [metadataMap]);

  const allScenes = useMemo(() => {
    const scenes = new Set<string>();
    Object.values(metadataMap).forEach(meta => {
      if (meta.analysis?.scene) scenes.add(meta.analysis.scene);
    });
    return ["All", ...Array.from(scenes)];
  }, [metadataMap]);

  // --- Map Coordinates ---
  const mapPoints = useMemo(() => {
    const points: { id: string|number, loc: Location, item: DirectoryItem, date: Date | null }[] = [];
    items.forEach(item => {
      const meta = metadataMap[item.id];
      const loc = extractLocation(meta);
      if (loc) {
        points.push({ id: item.id, loc, item, date: extractDate(meta) });
      }
    });
    return points.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  }, [items, metadataMap]);

  const mapBounds = useMemo(() => {
    if (mapPoints.length === 0) return null;
    const lats = mapPoints.map(p => p.loc.lat);
    const lons = mapPoints.map(p => p.loc.lon);
    return {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLon: Math.min(...lons), maxLon: Math.max(...lons),
    };
  }, [mapPoints]);

  // --- Filtering & Grouping Logic ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const meta = metadataMap[item.id];
      
      // Text Search
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // Scene Filter
      if (selectedScene !== "All" && meta?.analysis?.scene !== selectedScene) return false;
      
      // Emotion Filter
      if (showHappyMoments && !hasPositiveEmotion(meta)) return false;
      
      // People Filter
      if (selectedPerson) {
        const peopleIds = extractPeople(meta).map(p => p.userId);
        if (!peopleIds.includes(selectedPerson)) return false;
      }
      
      return true;
    });
  }, [items, metadataMap, searchQuery, selectedScene, showHappyMoments, selectedPerson]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    const unclassified: typeof filteredItems = [];

    filteredItems.forEach(item => {
      const meta = metadataMap[item.id];
      const date = extractDate(meta);
      if (date) {
        const dayStr = format(date, 'yyyy-MM-dd');
        if (!groups[dayStr]) groups[dayStr] = [];
        groups[dayStr].push(item);
      } else {
        unclassified.push(item);
      }
    });

    const sortedGroups = Object.keys(groups)
      .sort()
      .map((dateStr, idx) => ({
        id: dateStr,
        title: `Day ${idx + 1} - ${format(parseISO(dateStr), 'MMM do, yyyy')}`,
        items: groups[dateStr]
      }));

    if (unclassified.length > 0) {
      sortedGroups.push({ id: 'unclassified', title: 'Unclassified Memories', items: unclassified });
    }

    return sortedGroups;
  }, [filteredItems, metadataMap]);

  // --- Reel Logic ---
  const reelItems = useMemo(() => {
    return items.filter(item => {
      const meta = metadataMap[item.id];
      const people = extractPeople(meta);
      return people.length >= 1 && hasPositiveEmotion(meta);
    });
  }, [items, metadataMap]);

  const scrollToItem = (id: string | number) => {
    const el = refs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-primary', 'ring-offset-2', 'ring-offset-slate-50', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-primary', 'ring-offset-2', 'ring-offset-slate-50');
      }, 2000);
    }
  };

  if (loading && !trip) {
    return (
      <div className="min-h-screen bg-[#0a0810] flex flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-zinc-400">Loading your memories...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0810] text-white font-sans pb-32 animate-in fade-in duration-700">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0810]/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/trips")}
              className="h-10 w-10 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-white tracking-tight">{trip?.title}</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              onClick={handleAnalyze}
              disabled={analyzing}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-3 sm:px-4 rounded-xl text-xs text-white"
            >
              {analyzing ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{analyzing ? "Analyzing..." : "Analyze"}</span>
            </Button>
            
            {reelItems.length > 0 && (
              <Button 
                onClick={() => setIsReelOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-10 px-3 sm:px-5 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
              >
                <Play className="h-4 w-4 sm:mr-2 fill-white" />
                <span className="hidden sm:inline">Play Reel</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Interactive Map Section */}
      <div className="w-full h-[40vh] sm:h-[50vh] bg-white/5 relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
        
        {/* Custom SVG Map Visualization */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          {mapPoints.length > 0 && mapBounds ? (
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Draw connecting lines */}
                <path
                  d={mapPoints.map((p, i) => {
                    const x = ((p.loc.lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon || 1)) * 100;
                    const y = 100 - ((p.loc.lat - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat || 1)) * 100;
                    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                  }).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary opacity-50"
                  strokeDasharray="4 4"
                />
              </svg>
              {/* Draw Pins */}
              {mapPoints.map((p) => {
                const x = ((p.loc.lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon || 1)) * 100;
                const y = 100 - ((p.loc.lat - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat || 1)) * 100;
                return (
                  <button
                    key={p.id}
                    onClick={() => scrollToItem(p.id)}
                    className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-primary border-2 border-[#0a0810] shadow-md transform hover:scale-150 transition-all group z-10"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#0a0810] text-white border border-white/10 text-[10px] px-2 py-1 rounded font-medium whitespace-nowrap pointer-events-none transition-opacity">
                      {p.item.name}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-zinc-500 flex flex-col items-center">
              <MapPin className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">No location data available for this trip yet</p>
            </div>
          )}
        </div>

        {/* Map Overlay info */}
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-8 bg-[#0a0810]/90 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-xl border border-white/10 sm:max-w-xs pointer-events-none">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Trip Overview</p>
          <h2 className="text-xl font-bold text-white leading-tight mb-2">{trip?.title}</h2>
          <p className="text-xs text-zinc-400 font-medium">
            {mapPoints.length} locations mapped • {items.length} memories captured
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-12">
        {/* Smart Filters Bar */}
        <div className="bg-[#0a0810] rounded-3xl p-4 sm:p-6 shadow-sm border border-white/10 sticky top-20 z-30 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 justify-between">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-3 sm:gap-4 overflow-x-auto pb-2 sm:pb-0 scrollbar-none w-full sm:w-auto">
            {/* Emotion Filter */}
            <Button
              onClick={() => setShowHappyMoments(!showHappyMoments)}
              variant={showHappyMoments ? "default" : "outline"}
              className={cn(
                "rounded-xl transition-all font-bold text-xs h-10 shadow-sm shrink-0",
                showHappyMoments ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-amber-500/30" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Smile className={cn("h-4 w-4 mr-2", showHappyMoments ? "text-amber-400" : "")} />
              Happy Moments
            </Button>

            {/* People Filter */}
            {allPeople.length > 0 && (
              <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPerson(null)}
                  className={cn(
                    "rounded-lg px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all",
                    !selectedPerson ? "bg-white/10 shadow-sm text-white" : "text-zinc-500 hover:text-white"
                  )}
                >
                  All
                </Button>
                {allPeople.map(p => (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedPerson(p.userId)}
                    className={cn(
                      "h-8 w-8 rounded-lg overflow-hidden border-2 transition-all mx-0.5",
                      selectedPerson === p.userId ? "border-primary scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    title={p.firstName}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.firstName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {p.firstName[0]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-none justify-between sm:justify-end">
            {/* Scene Tabs */}
            {allScenes.length > 1 && (
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                {allScenes.slice(0, 4).map(scene => (
                  <button
                    key={scene}
                    onClick={() => setSelectedScene(scene)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      selectedScene === scene ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {scene}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative group shrink-0 sm:shrink">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-48 bg-white/5 border-white/10 rounded-xl focus-visible:ring-primary/50 text-sm font-medium h-10"
              />
            </div>
          </div>
        </div>

        {/* Chronological Masonry Timeline */}
        <div className="space-y-16">
          {groupedByDay.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 border-dashed rounded-3xl">
              <ImageIcon className="h-16 w-16 mx-auto text-zinc-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No memories found</h3>
              <p className="text-xs text-zinc-500">Try adjusting your filters to find what you're looking for.</p>
            </div>

          ) : (
            groupedByDay.map(group => (
              <div key={group.id} className="space-y-6">
                {/* Date Divider */}
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{group.title}</h2>
                  <div className="h-px flex-1 bg-white/10"></div>
                </div>

                {/* Masonry Grid */}
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                  {group.items.map(item => {
                    const meta = metadataMap[item.id];
                    const tags = extractTags(meta);
                    const people = extractPeople(meta);
                    const isHappy = hasPositiveEmotion(meta);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        className="break-inside-avoid relative group cursor-pointer"
                        ref={(el) => { refs.current[item.id] = el; }}
                      >
                        <div className="rounded-2xl overflow-hidden shadow-sm bg-zinc-900 border border-white/10 transition-all duration-500 group-hover:shadow-2xl group-hover:border-primary/50 group-hover:-translate-y-1">
                          <div className="relative aspect-[4/5] bg-[#0a0810]">
                            <FileThumbnail 
                              fileId={item.id} 
                              type={item.type} 
                              className="w-full h-full !rounded-none" 
                            />
                            
                            {/* Hover Glassmorphism Tooltip */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 backdrop-blur-[2px]">
                              <div className="bg-[#0a0810]/95 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                {people.length > 0 && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <Users className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                                      {people.map(p => p.firstName).join(", ")}
                                    </span>
                                  </div>
                                )}
                                
                                {tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {tags.slice(0, 3).map(tag => (
                                      <Badge key={tag} variant="secondary" className="bg-white/10 hover:bg-white/20 text-zinc-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none">
                                        #{tag.replace(/\s+/g, '')}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                
                                {!people.length && !tags.length && (
                                  <p className="text-xs font-medium text-zinc-500">No smart tags yet.</p>
                                )}
                              </div>
                            </div>

                            {/* Emotion Indicator */}
                            {isHappy && (
                              <div className="absolute top-3 right-3 bg-black/40 border border-white/10 backdrop-blur shadow-sm p-1.5 rounded-full text-amber-400 transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                                <Heart className="h-4 w-4 fill-amber-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Highlight Reel Modal */}
      <AnimatePresence>
        {isReelOpen && reelItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0810]/98 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 text-white/70 hover:text-white hover:bg-white/10 rounded-full h-12 w-12"
              onClick={() => setIsReelOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="w-full max-w-5xl aspect-video relative flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={reelIndex}
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl bg-black"
                >
                  <FullQualityImage 
                    fileId={reelItems[reelIndex].id} 
                    className="w-full h-full !rounded-none object-contain" 
                  />
                  
                  {/* Cinematic Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                  
                  <div className="absolute bottom-10 left-10 right-10">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-4 text-white"
                    >
                      {extractDate(metadataMap[reelItems[reelIndex].id]) && (
                        <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-none px-4 py-1.5 text-sm font-semibold tracking-wide">
                          {format(extractDate(metadataMap[reelItems[reelIndex].id])!, 'MMM do')}
                        </Badge>
                      )}
                      <p className="text-2xl font-bold tracking-tight">
                        {extractPeople(metadataMap[reelItems[reelIndex].id]).map(p => p.firstName).join(", ")}
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Progress Bar */}
              <div className="absolute -bottom-8 left-0 right-0 flex gap-2">
                {reelItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setReelIndex(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === reelIndex ? "bg-white flex-1" : "bg-white/30 w-8 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            </div>
            
            <ReelAutoAdvance
              enabled={isReelOpen && reelItems.length > 1}
              reelLength={reelItems.length}
              onAdvance={() => setReelIndex((prev) => (prev + 1) % reelItems.length)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB & Upload Progress */}
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
                  Upload Image
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
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" multiple onChange={onFileUpload} />
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]">
          <Info className="h-4 w-4" />
          <span className="text-xs font-bold">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 p-0 hover:bg-white/10 rounded-full ml-2">×</Button>
        </motion.div>
      )}

      {uploadProgress && (
        <motion.div 
          initial={{ opacity: 0, y: -20, scale: 0.95 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed !top-4 !right-4 !left-4 sm:!left-auto sm:!w-80 bg-[#0a0810]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl z-[9999]"
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
            <Progress value={uploadProgress.progress} className="h-1" />
          </div>
        </motion.div>
      )}
    </div>
  );
};
