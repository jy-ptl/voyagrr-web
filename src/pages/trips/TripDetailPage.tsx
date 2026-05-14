import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Services & Types
import { tripService } from "@/services/tripService";
import { directoryService } from "@/services/directoryService";
import { metadataService } from "@/services/metadataService";
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

// --- Helpers ---
const extractLocation = (meta: FileMetadata | undefined): Location | null => {
    if (!meta?.file?.location) return null;
    try {
        if (typeof meta.file.location === "string") {
            const parsed = JSON.parse(meta.file.location);
            if (parsed.lat && parsed.lon) return parsed;
        } else if (typeof meta.file.location === "object") {
            const loc = meta.file.location as any;
            if (loc.lat && loc.lon) return { lat: loc.lat, lon: loc.lon };
        }
    } catch (e) {}
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
        .map((e: any) => (typeof e === "string" ? e : e.emotion))
        .filter(Boolean);
};

const extractTags = (meta: FileMetadata | undefined): string[] => {
    if (!meta?.analysis?.tags) return [];
    return meta.analysis.tags.map((t: any) => t.tag).filter(Boolean);
};

const extractPeople = (meta: FileMetadata | undefined): Person[] => {
    if (!meta?.recognition?.faces) return [];
    const people: Person[] = [];
    meta.recognition.faces.forEach((f: any) => {
        if (f.user && f.user.firstName) {
            people.push({
                userId: f.userId || f.user.username,
                firstName: f.user.firstName,
                username: f.user.username,
                avatarUrl: f.user.avatarUrl,
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

            const contents =
                await directoryService.fetchContents(rootDirectoryId);
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
        } catch (err) {
            console.error("Failed to fetch trip details:", err);
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
            setTimeout(() => {
                setAnalyzing(false);
                fetchData();
            }, 2000);
        } catch (err) {
            setAnalyzing(false);
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
                points.push({
                    id: item.id,
                    loc,
                    item,
                    date: extractDate(meta),
                });
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
            if (
                selectedScene !== "All" &&
                meta?.analysis?.scene !== selectedScene
            )
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
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-medium text-slate-600">
                    Loading your memories...
                </h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/trips")}
                            className="h-10 w-10 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                            {trip?.title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            variant="outline"
                            className="rounded-full bg-white hover:bg-slate-50 border-slate-200 text-sm font-semibold tracking-wide text-indigo-600 hover:text-indigo-700 shadow-sm transition-all"
                        >
                            {analyzing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            {analyzing ? "Analyzing..." : "Smart Analyze"}
                        </Button>

                        {reelItems.length > 0 && (
                            <Button
                                onClick={() => setIsReelOpen(true)}
                                className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Play className="h-4 w-4 mr-2 fill-white" />
                                Play Reel
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Interactive Map Section */}
            <div className="w-full h-[40vh] sm:h-[50vh] bg-indigo-50/50 relative overflow-hidden border-b border-slate-200">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-60"></div>

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
                                                ((p.loc.lon -
                                                    mapBounds.minLon) /
                                                    (mapBounds.maxLon -
                                                        mapBounds.minLon ||
                                                        1)) *
                                                100;
                                            const y =
                                                100 -
                                                ((p.loc.lat -
                                                    mapBounds.minLat) /
                                                    (mapBounds.maxLat -
                                                        mapBounds.minLat ||
                                                        1)) *
                                                    100;
                                            return `${i === 0 ? "M" : "L"} ${x}% ${y}%`;
                                        })
                                        .join(" ")}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-indigo-400 opacity-50"
                                    strokeDasharray="4 4"
                                />
                            </svg>
                            {/* Draw Pins */}
                            {mapPoints.map((p) => {
                                const x =
                                    ((p.loc.lon - mapBounds.minLon) /
                                        (mapBounds.maxLon - mapBounds.minLon ||
                                            1)) *
                                    100;
                                const y =
                                    100 -
                                    ((p.loc.lat - mapBounds.minLat) /
                                        (mapBounds.maxLat - mapBounds.minLat ||
                                            1)) *
                                        100;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => scrollToItem(p.id)}
                                        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-white border-2 border-indigo-600 shadow-md transform hover:scale-150 transition-all group z-10"
                                        style={{ left: `${x}%`, top: `${y}%` }}
                                    >
                                        <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-medium whitespace-nowrap pointer-events-none transition-opacity">
                                            {p.item.name}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                            <MapPin className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">
                                No location data available for this trip yet
                            </p>
                        </div>
                    )}
                </div>

                {/* Map Overlay info */}
                <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-8 bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-white/20 sm:max-w-xs pointer-events-none">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                        Trip Overview
                    </p>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight mb-2">
                        {trip?.title}
                    </h2>
                    <p className="text-sm text-slate-600 font-medium">
                        {mapPoints.length} locations mapped • {items.length}{" "}
                        memories captured
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-12">
                {/* Smart Filters Bar */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 sticky top-20 z-30 flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Emotion Filter */}
                        <Button
                            onClick={() =>
                                setShowHappyMoments(!showHappyMoments)
                            }
                            variant={showHappyMoments ? "default" : "outline"}
                            className={cn(
                                "rounded-full transition-all font-semibold shadow-sm",
                                showHappyMoments
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
                                    : "bg-white text-slate-600 hover:bg-slate-50",
                            )}
                        >
                            <Smile
                                className={cn(
                                    "h-4 w-4 mr-2",
                                    showHappyMoments ? "text-amber-500" : "",
                                )}
                            />
                            Happy Moments
                        </Button>

                        {/* People Filter */}
                        {allPeople.length > 0 && (
                            <div className="flex items-center bg-slate-50 p-1.5 rounded-full border border-slate-200">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedPerson(null)}
                                    className={cn(
                                        "rounded-full px-3 text-xs font-bold transition-all",
                                        !selectedPerson
                                            ? "bg-white shadow-sm text-slate-900"
                                            : "text-slate-500 hover:text-slate-900",
                                    )}
                                >
                                    All
                                </Button>
                                {allPeople.map((p) => (
                                    <button
                                        key={p.userId}
                                        onClick={() =>
                                            setSelectedPerson(p.userId)
                                        }
                                        className={cn(
                                            "h-8 w-8 rounded-full overflow-hidden border-2 transition-all mx-0.5",
                                            selectedPerson === p.userId
                                                ? "border-indigo-500 scale-110 shadow-md"
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
                                            <div className="h-full w-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                                {p.firstName[0]}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Scene Tabs */}
                        {allScenes.length > 1 && (
                            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                                {allScenes.slice(0, 4).map((scene) => (
                                    <button
                                        key={scene}
                                        onClick={() => setSelectedScene(scene)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                                            selectedScene === scene
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700",
                                        )}
                                    >
                                        {scene}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-full sm:w-48 bg-slate-50 border-slate-200 rounded-full focus-visible:ring-indigo-500 text-sm font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Chronological Masonry Timeline */}
                <div className="space-y-16">
                    {groupedByDay.length === 0 ? (
                        <div className="text-center py-20">
                            <ImageIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-xl font-medium text-slate-600">
                                No memories found matching your filters.
                            </h3>
                        </div>
                    ) : (
                        groupedByDay.map((group) => (
                            <div key={group.id} className="space-y-6">
                                {/* Date Divider */}
                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                                        {group.title}
                                    </h2>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>

                                {/* Masonry Grid */}
                                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                                    {group.items.map((item) => {
                                        const meta = metadataMap[item.id];
                                        const tags = extractTags(meta);
                                        const people = extractPeople(meta);
                                        const isHappy =
                                            hasPositiveEmotion(meta);

                                        return (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                whileInView={{
                                                    opacity: 1,
                                                    y: 0,
                                                }}
                                                viewport={{
                                                    once: true,
                                                    margin: "-50px",
                                                }}
                                                className="break-inside-avoid relative group cursor-pointer"
                                                ref={(el) => {
                                                    refs.current[item.id] = el;
                                                }}
                                            >
                                                <div className="rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-100 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-indigo-500/20 group-hover:-translate-y-1">
                                                    <div className="relative aspect-[4/5]">
                                                        <FileThumbnail
                                                            fileId={item.id}
                                                            type={item.type}
                                                            className="w-full h-full !rounded-none"
                                                        />

                                                        {/* Hover Glassmorphism Tooltip */}
                                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 backdrop-blur-[2px]">
                                                            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                                {people.length >
                                                                    0 && (
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                                                                        <span className="text-xs font-bold text-slate-700">
                                                                            {people
                                                                                .map(
                                                                                    (
                                                                                        p,
                                                                                    ) =>
                                                                                        p.firstName,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                )}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {tags.length >
                                                                    0 && (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {tags
                                                                            .slice(
                                                                                0,
                                                                                3,
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    tag,
                                                                                ) => (
                                                                                    <Badge
                                                                                        key={
                                                                                            tag
                                                                                        }
                                                                                        variant="secondary"
                                                                                        className="bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5"
                                                                                    >
                                                                                        #
                                                                                        {tag.replace(
                                                                                            /\s+/g,
                                                                                            "",
                                                                                        )}
                                                                                    </Badge>
                                                                                ),
                                                                            )}
                                                                    </div>
                                                                )}

                                                                {!people.length &&
                                                                    !tags.length && (
                                                                        <p className="text-xs font-medium text-slate-500">
                                                                            No
                                                                            smart
                                                                            tags
                                                                            yet.
                                                                        </p>
                                                                    )}
                                                            </div>
                                                        </div>

                                                        {/* Emotion Indicator */}
                                                        {isHappy && (
                                                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow-sm p-1.5 rounded-full text-amber-500 transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                                                                <Heart className="h-4 w-4 fill-amber-500" />
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
                        className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
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
                                    initial={{
                                        opacity: 0,
                                        scale: 0.95,
                                        filter: "blur(10px)",
                                    }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        filter: "blur(0px)",
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 1.05,
                                        filter: "blur(10px)",
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        ease: "easeInOut",
                                    }}
                                    className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl bg-black"
                                >
                                    <FileThumbnail
                                        fileId={reelItems[reelIndex].id}
                                        type="file"
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
                                            {extractDate(
                                                metadataMap[
                                                    reelItems[reelIndex].id
                                                ],
                                            ) && (
                                                <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-none px-4 py-1.5 text-sm font-semibold tracking-wide">
                                                    {format(
                                                        extractDate(
                                                            metadataMap[
                                                                reelItems[
                                                                    reelIndex
                                                                ].id
                                                            ],
                                                        )!,
                                                        "MMM do",
                                                    )}
                                                </Badge>
                                            )}
                                            <p className="text-2xl font-bold tracking-tight">
                                                {extractPeople(
                                                    metadataMap[
                                                        reelItems[reelIndex].id
                                                    ],
                                                )
                                                    .map((p) => p.firstName)
                                                    .join(", ")}
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
                                            idx === reelIndex
                                                ? "bg-white flex-1"
                                                : "bg-white/30 w-8 hover:bg-white/50",
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Auto-play logic */}
                        <React.Suspense fallback={null}>
                            {React.createElement(() => {
                                useEffect(() => {
                                    const timer = setTimeout(() => {
                                        setReelIndex(
                                            (prev) =>
                                                (prev + 1) % reelItems.length,
                                        );
                                    }, 4000);
                                    return () => clearTimeout(timer);
                                }, [reelIndex]);
                                return null;
                            })}
                        </React.Suspense>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
