import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import {
  ArrowLeft,
  MapPin,
  Search,
  Play,
  Loader2,
  Sparkles,
  X,
  Smile,
  Users,
  Heart,
  Image as ImageIcon,
  Upload,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
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
type Location = { lat: number; lon: number };
type Person = {
  userId: string;
  firstName: string;
  username: string;
  avatarUrl?: string;
};

type EmotionRecord = {
  emotion: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// --- Helpers ---
const extractLocation = (meta: FileMetadata | undefined): Location | null => {
  if (!meta?.file?.location) return null;
  try {
    if (typeof meta.file.location === "string") {
      const parsed = JSON.parse(meta.file.location);
      if (parsed.lat && parsed.lon) return parsed;
    } else {
      const loc = meta.file.location as unknown;
      if (
        isRecord(loc) &&
        typeof loc.lat === "number" &&
        typeof loc.lon === "number"
      ) {
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
    const d = parseISO(meta.file.createdOn.replace(" ", "T"));
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
};

const extractEmotions = (meta: FileMetadata | undefined): string[] => {
  if (!meta?.analysis?.emotions) return [];
  return meta.analysis.emotions
    .map((emotion: EmotionRecord | string) =>
      typeof emotion === "string" ? emotion : emotion.emotion,
    )
    .filter(Boolean);
};

const extractTags = (meta: FileMetadata | undefined): string[] => {
  if (!meta?.analysis?.tags) return [];
  return meta.analysis.tags.map((tag) => tag.tag).filter(Boolean);
};

const extractPeople = (meta: FileMetadata | undefined): Person[] => {
  if (!meta?.recognition?.faces) return [];
  const people: Person[] = [];
  meta.recognition.faces.forEach((face) => {
    if (face.user && face.user.firstName) {
      people.push({
        userId: face.userId || face.user.username,
        firstName: face.user.firstName,
        username: face.user.username,
        avatarUrl: face.user.avatarUrl,
      });
    }
  });
  return people;
};

const hasPositiveEmotion = (meta: FileMetadata | undefined): boolean => {
  const emotions = extractEmotions(meta).map((e) => e.toLowerCase());
  return emotions.some((e) =>
    ["happy", "joy", "amazed", "excited", "love"].includes(e),
  );
};

/** In-memory cache so reel slides reuse blobs; only one ahead is prefetched at a time. */
const reelImageUrlCache = new Map<string | number, string>();
const reelImageUrlRequests = new Map<string | number, Promise<string>>();

const fetchReelImageUrl = (fileId: string | number): Promise<string> => {
  const cached = reelImageUrlCache.get(fileId);
  if (cached) return Promise.resolve(cached);

  let request = reelImageUrlRequests.get(fileId);
  if (!request) {
    request = storageService
      .downloadFile(fileId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        reelImageUrlCache.set(fileId, url);
        return url;
      })
      .finally(() => {
        reelImageUrlRequests.delete(fileId);
      });
    reelImageUrlRequests.set(fileId, request);
  }

  return request;
};

const prefetchReelImage = (fileId: string | number) => {
  void fetchReelImageUrl(fileId).catch((err) =>
    console.warn(`Failed to prefetch reel image ${fileId}`, err),
  );
};

const FullQualityImage = ({
  fileId,
  className,
}: {
  fileId: string | number;
  className?: string;
}) => {
  const [url, setUrl] = useState<string | null>(
    () => reelImageUrlCache.get(fileId) ?? null,
  );

  useEffect(() => {
    let isMounted = true;

    fetchReelImageUrl(fileId)
      .then((resolved) => {
        if (isMounted) setUrl(resolved);
      })
      .catch((err) => console.error("Failed to fetch full image", err));

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  if (!url) {
    return (
      <div
        className={cn("bg-black flex items-center justify-center", className)}
      >
        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Full quality"
      className={cn("h-full w-full object-contain", className)}
    />
  );
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

type HorizontalScrollRailProps = {
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
  showSwipeHint?: boolean;
};

const scrollRailChipClass = (active?: boolean) =>
  cn(
    "inline-flex h-9 shrink-0 snap-start items-center justify-center rounded-full border px-3.5 text-xs font-bold whitespace-nowrap transition-colors touch-manipulation",
    active
      ? "border-white/20 bg-white/15 text-white shadow-sm"
      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
  );

const scrollRailTrackClass =
  "flex min-h-11 min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const HorizontalScrollRail = ({
  children,
  className,
  ariaLabel,
  showSwipeHint = true,
}: HorizontalScrollRailProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [edges, setEdges] = useState({ left: false, right: false });
  const [overflows, setOverflows] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const refreshEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setEdges({ left: false, right: false });
      setOverflows(false);
      return;
    }
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 8;
    setOverflows(hasOverflow);
    setEdges({
      left: hasOverflow && scrollLeft > 8,
      right: hasOverflow && scrollLeft + clientWidth < scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    refreshEdges();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", refreshEdges, { passive: true });
    const observer = new ResizeObserver(refreshEdges);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", refreshEdges);
      observer.disconnect();
    };
  }, [refreshEdges, children]);

  const scrollByAmount = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
    el.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = scrollRef.current;
    if (!el) return;

    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 4) dragRef.current.moved = true;
    el.scrollLeft = dragRef.current.scrollLeft - delta;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = scrollRef.current;
    dragRef.current.active = false;
    setIsDragging(false);
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    refreshEdges();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.moved = false;
    }
  };

  return (
    <div className={cn("relative min-w-0 w-full", className)}>
      <div
        className={cn("relative", overflows ? "w-full" : "inline-flex max-w-full")}
      >
        {edges.left && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 z-[2] h-full w-12 rounded-l-full bg-gradient-to-r from-[#0a0810] via-[#0a0810]/80 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => scrollByAmount(-200)}
              className="absolute left-1.5 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0a0810]/95 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-white/10 touch-manipulation"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
        {edges.right && (
          <>
            <div
              className="pointer-events-none absolute right-0 top-0 z-[2] h-full w-12 rounded-r-full bg-gradient-to-l from-[#0a0810] via-[#0a0810]/80 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => scrollByAmount(200)}
              className="absolute right-1.5 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0a0810]/95 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-white/10 touch-manipulation"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className={cn(
            scrollRailTrackClass,
            "snap-x snap-proximity",
            overflows ? "w-full cursor-grab" : "w-max cursor-default",
            isDragging && "cursor-grabbing select-none",
          )}
          role="region"
          aria-label={ariaLabel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(event) => {
            if (dragRef.current.active) endDrag(event);
          }}
          onClickCapture={handleClickCapture}
        >
          {children}
        </div>
      </div>
      {showSwipeHint && edges.right && (
        <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Drag, swipe, or use arrows for more
        </p>
      )}
    </div>
  );
};


export const TripDetailPage = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  // Data State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [metadataMap, setMetadataMap] = useState<
    Record<string | number, FileMetadata>
  >({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Upload & FAB State
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
  } | null>(null);
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
      const filesOnly = (contents.files || []).map((file) => ({
        ...file,
        type: "file" as const,
      }));
      setItems(filesOnly);

      try {
        const metaResponses =
          await metadataService.getDirectoryMetadata(rootDirectoryId);
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
    const oversizedFiles = filesArray.filter(
      (file) => file.size > 10 * 1024 * 1024,
    );

    if (oversizedFiles.length > 0) {
      setError(
        `Some files are too large (max 10MB): ${oversizedFiles.map((f) => f.name).join(", ")}`,
      );
      return;
    }

    try {
      const onProgress = (percent: number) => {
        setUploadProgress({
          fileName:
            filesArray.length === 1
              ? filesArray[0].name
              : `${filesArray.length} files`,
          progress: percent,
        });
      };

      if (filesArray.length === 1) {
        await storageService.uploadFile(
          filesArray[0],
          trip?.directoryId ?? null,
          onProgress,
        );
      } else {
        await storageService.uploadFilesBatch(
          filesArray,
          trip?.directoryId ?? null,
          onProgress,
        );
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
    Object.values(metadataMap).forEach((meta) => {
      extractPeople(meta).forEach((p) => map.set(p.userId, p));
    });
    return Array.from(map.values());
  }, [metadataMap]);

  const allScenes = useMemo(() => {
    const scenes = new Set<string>();
    Object.values(metadataMap).forEach((meta) => {
      if (meta.analysis?.scene) scenes.add(meta.analysis.scene);
    });
    return ["All", ...Array.from(scenes)];
  }, [metadataMap]);

  // --- Map Coordinates ---
  const mapPoints = useMemo(() => {
    const points: {
      id: string | number;
      loc: Location;
      item: DirectoryItem;
      date: Date | null;
    }[] = [];
    items.forEach((item) => {
      const meta = metadataMap[item.id];
      const loc = extractLocation(meta);
      if (loc) {
        points.push({ id: item.id, loc, item, date: extractDate(meta) });
      }
    });
    return points.sort(
      (a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0),
    );
  }, [items, metadataMap]);

  const mapBounds = useMemo(() => {
    if (mapPoints.length === 0) return null;
    const lats = mapPoints.map((p) => p.loc.lat);
    const lons = mapPoints.map((p) => p.loc.lon);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [mapPoints]);

  // --- Filtering & Grouping Logic ---
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const meta = metadataMap[item.id];

      // Text Search
      if (
        searchQuery &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;

      // Scene Filter
      if (selectedScene !== "All" && meta?.analysis?.scene !== selectedScene)
        return false;

      // Emotion Filter
      if (showHappyMoments && !hasPositiveEmotion(meta)) return false;

      // People Filter
      if (selectedPerson) {
        const peopleIds = extractPeople(meta).map((p) => p.userId);
        if (!peopleIds.includes(selectedPerson)) return false;
      }

      return true;
    });
  }, [
    items,
    metadataMap,
    searchQuery,
    selectedScene,
    showHappyMoments,
    selectedPerson,
  ]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    const unclassified: typeof filteredItems = [];

    filteredItems.forEach((item) => {
      const meta = metadataMap[item.id];
      const date = extractDate(meta);
      if (date) {
        const dayStr = format(date, "yyyy-MM-dd");
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
        title: `Day ${idx + 1} - ${format(parseISO(dateStr), "MMM do, yyyy")}`,
        items: groups[dateStr],
      }));

    if (unclassified.length > 0) {
      sortedGroups.push({
        id: "unclassified",
        title: "Unclassified Memories",
        items: unclassified,
      });
    }

    return sortedGroups;
  }, [filteredItems, metadataMap]);

  // --- Reel Logic ---
  const reelItems = useMemo(() => {
    return items.filter((item) => {
      const meta = metadataMap[item.id];
      const people = extractPeople(meta);
      return people.length >= 1 && hasPositiveEmotion(meta);
    });
  }, [items, metadataMap]);

  // Prefetch only the next reel slide while viewing the current one
  useEffect(() => {
    if (!isReelOpen || reelItems.length === 0) return;

    const current = reelItems[reelIndex];
    if (current) {
      void fetchReelImageUrl(current.id).catch(() => {});
    }

    if (reelItems.length > 1) {
      const nextItem = reelItems[(reelIndex + 1) % reelItems.length];
      if (nextItem) prefetchReelImage(nextItem.id);
    }
  }, [isReelOpen, reelIndex, reelItems]);

  const scrollToItem = (id: string | number) => {
    const el = refs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(
        "ring-4",
        "ring-primary",
        "ring-offset-2",
        "ring-offset-slate-50",
        "transition-all",
      );
      setTimeout(() => {
        el.classList.remove(
          "ring-4",
          "ring-primary",
          "ring-offset-2",
          "ring-offset-slate-50",
        );
      }, 2000);
    }
  };

  if (loading && !trip) {
    return (
      <div className="min-h-screen bg-[#0a0810] flex flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-zinc-400">
          Loading your memories...
        </h2>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 mb-0 min-h-[calc(100dvh-4rem)] min-w-0 w-[calc(100%+2rem)] max-w-none overflow-x-hidden bg-[#0a0810] pb-28 font-sans text-white animate-in fade-in duration-700 lg:-mx-6 lg:w-[calc(100%+3rem)]">
      {/* Header */}
      <header className="sticky top-0 z-40 overflow-visible border-b border-white/10 bg-[#0a0810]/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-[3.75rem] min-w-0 max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:min-h-16 sm:px-6 sm:py-2.5 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/trips")}
              className="h-10 w-10 shrink-0 rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
              {trip?.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              variant="outline"
              className="h-10 shrink-0 rounded-xl border-white/10 bg-white/5 px-3 text-xs text-white hover:bg-white/10 sm:px-4"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {analyzing ? "Analyzing..." : "Analyze"}
              </span>
            </Button>

            {reelItems.length > 0 && (
              <Button
                onClick={() => {
                  setReelIndex(0);
                  setIsReelOpen(true);
                }}
                className="h-10 shrink-0 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 active:bg-primary/80 touch-manipulation sm:px-5"
                aria-label="Play highlight reel"
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
              <svg
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                {/* Draw connecting lines */}
                <path
                  d={mapPoints
                    .map((p, i) => {
                      const x =
                        ((p.loc.lon - mapBounds.minLon) /
                          (mapBounds.maxLon - mapBounds.minLon || 1)) *
                        100;
                      const y =
                        100 -
                        ((p.loc.lat - mapBounds.minLat) /
                          (mapBounds.maxLat - mapBounds.minLat || 1)) *
                          100;
                      return `${i === 0 ? "M" : "L"} ${x}% ${y}%`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary opacity-50"
                  strokeDasharray="4 4"
                />
              </svg>
              {/* Draw Pins */}
              {mapPoints.map((p) => {
                const x =
                  ((p.loc.lon - mapBounds.minLon) /
                    (mapBounds.maxLon - mapBounds.minLon || 1)) *
                  100;
                const y =
                  100 -
                  ((p.loc.lat - mapBounds.minLat) /
                    (mapBounds.maxLat - mapBounds.minLat || 1)) *
                    100;
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
            <div className="flex max-w-xs flex-col items-center px-6 text-center text-zinc-500">
              <MapPin className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm font-medium leading-relaxed">
                No location data available for this trip yet
              </p>
            </div>
          )}
        </div>

        {/* Map Overlay info */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 min-w-0 max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0a0810]/90 px-4 py-3 shadow-xl backdrop-blur-md sm:left-auto sm:right-8 sm:max-w-xs sm:px-6 sm:py-4">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-primary">
            Trip Overview
          </p>
          <h2 className="mb-2 truncate text-xl font-bold leading-tight text-white">
            {trip?.title}
          </h2>
          <p className="text-xs font-medium text-zinc-400">
            {mapPoints.length} locations mapped • {items.length} memories
            captured
          </p>
        </div>
      </div>

      <div className="mx-auto mt-6 min-w-0 max-w-7xl space-y-10 px-4 sm:mt-8 sm:space-y-12 sm:px-6 lg:px-8">
        {/* Smart Filters */}
        <section className="sticky top-[3.75rem] z-30 min-w-0 rounded-3xl border border-white/10 bg-[#0a0810] p-4 shadow-sm sm:top-16 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4">
            <HorizontalScrollRail ariaLabel="People and mood filters">
            <Button
              onClick={() => setShowHappyMoments(!showHappyMoments)}
              variant={showHappyMoments ? "default" : "outline"}
              className={cn(
                scrollRailChipClass(false),
                showHappyMoments
                  ? "border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300"
                  : "",
              )}
            >
              <Smile
                className={cn(
                  "h-4 w-4 mr-2",
                  showHappyMoments ? "text-amber-400" : "",
                )}
              />
              Happy Moments
            </Button>

            {/* People Filter */}
            {allPeople.length > 0 && (
              <div className="flex h-9 shrink-0 snap-start items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPerson(null)}
                  className={cn(
                    "h-7 rounded-full px-3 text-[10px] font-black uppercase tracking-widest transition-colors",
                    !selectedPerson
                      ? "bg-white/10 shadow-sm text-white"
                      : "text-zinc-500 hover:text-white",
                  )}
                >
                  All
                </Button>
                {allPeople.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedPerson(p.userId)}
                    className={cn(
                      "h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 transition-all touch-manipulation",
                      selectedPerson === p.userId
                        ? "border-primary shadow-md ring-2 ring-primary/30"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    title={p.firstName}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.firstName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {p.firstName[0]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            </HorizontalScrollRail>

            {allScenes.length > 1 && (
              <HorizontalScrollRail ariaLabel="Filter by scene">
                {allScenes.map((scene) => (
                  <button
                    key={scene}
                    type="button"
                    role="tab"
                    aria-selected={selectedScene === scene}
                    onClick={() => setSelectedScene(scene)}
                    className={scrollRailChipClass(selectedScene === scene)}
                  >
                    {scene}
                  </button>
                ))}
              </HorizontalScrollRail>
            )}

            <div className="relative min-w-0 w-full pr-14 sm:pr-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full min-w-0 rounded-full border-white/10 bg-white/[0.04] pl-9 text-sm font-medium focus-visible:ring-primary/50"
              />
            </div>
          </div>
        </section>

        {/* Chronological Masonry Timeline */}
        <div className="space-y-16">
          {groupedByDay.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 border-dashed rounded-3xl">
              <ImageIcon className="h-16 w-16 mx-auto text-zinc-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                No memories found
              </h3>
              <p className="text-xs text-zinc-500">
                Try adjusting your filters to find what you're looking for.
              </p>
            </div>
          ) : (
            groupedByDay.map((group) => (
              <div key={group.id} className="space-y-6">
                {/* Date Divider */}
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {group.title}
                  </h2>
                  <div className="h-px flex-1 bg-white/10"></div>
                </div>

                {/* Masonry Grid */}
                <div className="min-w-0 columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3 xl:columns-4">
                  {group.items.map((item) => {
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
                        ref={(el) => {
                          refs.current[item.id] = el;
                        }}
                      >
                        <div className="rounded-2xl overflow-hidden shadow-sm bg-zinc-900 border border-white/10 transition-all duration-500 group-hover:shadow-2xl group-hover:border-primary/50 group-hover:-translate-y-1">
                          <div className="relative aspect-[4/5] bg-[#0a0810]">
                            <FileThumbnail
                              fileId={item.id}
                              type={item.type}
                              className="w-full h-full !rounded-none"
                              fit="contain"
                            />

                            {/* Hover Glassmorphism Tooltip */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 backdrop-blur-[2px]">
                              <div className="bg-[#0a0810]/95 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                {people.length > 0 && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <Users className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                                      {people
                                        .map((p) => p.firstName)
                                        .join(", ")}
                                    </span>
                                  </div>
                                )}

                                {tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {tags.slice(0, 3).map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="bg-white/10 hover:bg-white/20 text-zinc-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none"
                                      >
                                        #{tag.replace(/\s+/g, "")}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {!people.length && !tags.length && (
                                  <p className="text-xs font-medium text-zinc-500">
                                    No smart tags yet.
                                  </p>
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
            className="fixed inset-0 z-[60] flex min-w-0 flex-col overflow-hidden bg-black"
            role="dialog"
            aria-modal="true"
            aria-label="Trip highlight reel"
          >
            <div className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
              {reelItems.length <= 12 ? (
                <div className="flex min-w-0 gap-1">
                  {reelItems.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReelIndex(idx)}
                      className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25"
                      aria-label={`Go to memory ${idx + 1}`}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full bg-white transition-all duration-300",
                          idx <= reelIndex ? "w-full" : "w-0",
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{
                      width: `${((reelIndex + 1) / reelItems.length) * 100}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {reelIndex + 1} / {reelItems.length}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-white/80 hover:bg-white/10 hover:text-white touch-manipulation"
                  onClick={() => setIsReelOpen(false)}
                  aria-label="Close reel"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <button
                type="button"
                className="absolute left-0 top-0 z-10 h-full w-[28%] touch-manipulation"
                onClick={() =>
                  setReelIndex(
                    (prev) =>
                      (prev - 1 + reelItems.length) % reelItems.length,
                  )
                }
                aria-label="Previous memory"
              />
              <button
                type="button"
                className="absolute right-0 top-0 z-10 h-full w-[28%] touch-manipulation"
                onClick={() =>
                  setReelIndex((prev) => (prev + 1) % reelItems.length)
                }
                aria-label="Next memory"
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={reelIndex}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center bg-black p-2 sm:p-6"
                >
                  <FullQualityImage
                    fileId={reelItems[reelIndex].id}
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
                </motion.div>
              </AnimatePresence>

              <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8">
                <motion.div
                  key={`reel-meta-${reelIndex}`}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
                >
                  {extractDate(metadataMap[reelItems[reelIndex].id]) && (
                    <Badge className="w-fit shrink-0 border-none bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                      {format(
                        extractDate(metadataMap[reelItems[reelIndex].id])!,
                        "MMM do",
                      )}
                    </Badge>
                  )}
                  {extractPeople(metadataMap[reelItems[reelIndex].id]).length >
                    0 && (
                    <p className="truncate text-base font-bold tracking-tight text-white sm:text-xl">
                      {extractPeople(metadataMap[reelItems[reelIndex].id])
                        .map((p) => p.firstName)
                        .join(", ")}
                    </p>
                  )}
                </motion.div>
              </div>
            </div>

            <ReelAutoAdvance
              enabled={isReelOpen && reelItems.length > 1}
              reelLength={reelItems.length}
              onAdvance={() =>
                setReelIndex((prev) => (prev + 1) % reelItems.length)
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB & Upload Progress */}
      <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-4 sm:bottom-8 sm:right-8">
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
            isFabOpen && "rotate-[135deg] bg-zinc-800 shadow-none",
          )}
          onClick={() => setIsFabOpen(!isFabOpen)}
        >
          <Plus className="h-8 w-8" strokeWidth={2.5} />
        </Button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={onFileUpload}
        />
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
        >
          <Info className="h-4 w-4" />
          <span className="text-xs font-bold">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 w-6 p-0 hover:bg-white/10 rounded-full ml-2"
          >
            ×
          </Button>
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
