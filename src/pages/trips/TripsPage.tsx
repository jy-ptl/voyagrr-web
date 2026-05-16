import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { cn } from "@/lib/utils";
import {
  Plus,
  Map as MapIcon,
  Globe,
  Search,
  ArrowRight,
  Users,
  Sparkles,
  Loader2,
  Compass,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileThumbnail } from "@/components/drive/FileThumbnail";

// Services & Types
import { tripService } from "@/services/tripService";
import { directoryService } from "@/services/directoryService";
import { groupService, type Group } from "@/services/groupService";
import { userService, type UserSearchResponse } from "@/services/userService";
import type { Trip, TripCreateRequest } from "@/types/trips";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const tripSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(50),
  description: z.string().max(500).optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]),
  status: z.enum(["PLANNED", "ONGOING", "COMPLETED"]),
  groupId: z.number().optional(),
  keycloakUserIds: z.array(z.string()),
});

type TripValues = z.infer<typeof tripSchema>;
type StatusFilter = "ALL" | Trip["status"];

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PLANNED", label: "Planned" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "COMPLETED", label: "Completed" },
];

const tripCoverCache = new Map<number, string | number | null>();
const tripCoverRequests = new Map<number, Promise<string | number | null>>();

const TripCoverThumbnail = ({
  directoryId,
  title,
}: {
  directoryId?: number;
  title: string;
}) => {
  const [coverFileId, setCoverFileId] = useState<string | number | null>(
    directoryId ? (tripCoverCache.get(directoryId) ?? null) : null,
  );
  const [loading, setLoading] = useState(
    directoryId !== undefined && !tripCoverCache.has(directoryId),
  );

  useEffect(() => {
    if (!directoryId) return;

    let mounted = true;

    const resolveCover = async () => {
      const cached = tripCoverCache.get(directoryId);
      if (cached !== undefined) {
        if (mounted) {
          setCoverFileId(cached);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setLoading(true);
      }

      try {
        let request = tripCoverRequests.get(directoryId);
        if (!request) {
          request = directoryService
            .fetchContents(directoryId)
            .then((content) => content.files?.[0]?.id ?? null)
            .catch(() => null);
          tripCoverRequests.set(directoryId, request);
        }

        const fileId = await request;
        tripCoverCache.set(directoryId, fileId);
        if (mounted) setCoverFileId(fileId);
      } finally {
        if (mounted) setLoading(false);
        tripCoverRequests.delete(directoryId);
      }
    };

    void resolveCover();

    return () => {
      mounted = false;
    };
  }, [directoryId]);

  if (loading) {
    return (
      <div className="h-full w-full animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
    );
  }

  if (!directoryId) {
    return (
      <div className="relative h-full w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-[#171126]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(170,59,255,0.25),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-200">
          {title.slice(0, 2)}
        </div>
      </div>
    );
  }

  if (coverFileId) {
    return (
      <FileThumbnail
        fileId={coverFileId}
        type="file"
        className="h-full w-full !rounded-none"
        fit="contain"
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-[#171126]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(170,59,255,0.25),transparent_45%)]" />
      <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-200">
        {title.slice(0, 2)}
      </div>
    </div>
  );
};

const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // User Search State
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResponse[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResponse[]>([]);

  // Group Search State
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Analysis State
  const [analyzingTrips, setAnalyzingTrips] = useState<Record<number, boolean>>(
    {},
  );

  const form = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      title: "",
      description: "",
      visibility: "PRIVATE",
      status: "PLANNED",
      keycloakUserIds: [],
    },
  });

  const handleUserSearch = useCallback(
    async (query: string) => {
      setUserSearch(query);
      if (query.length < 2) {
        setUserResults([]);
        return;
      }
      try {
        const results = await userService.searchUsers(query);
        setUserResults(
          results.filter(
            (r) =>
              !selectedUsers.find((s) => s.keycloakUserId === r.keycloakUserId),
          ),
        );
      } catch (error) {
        console.error("User search failed", error);
      }
    },
    [selectedUsers],
  );

  const handleGroupSearch = useCallback(async (query: string) => {
    setGroupSearch(query);
    if (query.length < 1) {
      setGroupResults([]);
      return;
    }
    try {
      const results = await groupService.searchGroups(query);
      setGroupResults(results);
    } catch (error) {
      console.error("Group search failed", error);
    }
  }, []);

  const selectGroup = (group: Group | null) => {
    setSelectedGroup(group);
    form.setValue("groupId", group?.groupId);
    setGroupSearch("");
    setGroupResults([]);
  };

  const toggleUserSelection = (user: UserSearchResponse) => {
    const isSelected = selectedUsers.find(
      (s) => s.keycloakUserId === user.keycloakUserId,
    );
    let newSelection;
    if (isSelected) {
      newSelection = selectedUsers.filter(
        (s) => s.keycloakUserId !== user.keycloakUserId,
      );
    } else {
      newSelection = [...selectedUsers, user];
    }
    setSelectedUsers(newSelection);
    form.setValue(
      "keycloakUserIds",
      newSelection.map((u) => u.keycloakUserId),
    );
    setUserSearch("");
    setUserResults([]);
  };

  const fetchTrips = useCallback(async () => {
    try {
      const data = await tripService.fetchTrips();
      setTrips(data || []);
    } catch (error) {
      console.error("Failed to fetch trips", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchTrips();
    });
  }, [fetchTrips]);

  const onTripCreate = async (values: TripValues) => {
    setCreateLoading(true);
    try {
      const newTrip = await tripService.createTrip(values as TripCreateRequest);
      setTrips((prev) => [...prev, newTrip]);
      setIsModalOpen(false);
      form.reset();
      setSelectedUsers([]);
      setSelectedGroup(null);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to create trip", error.response?.data);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAnalyzeTrip = async (e: React.MouseEvent, tripId: number) => {
    e.stopPropagation();
    if (analyzingTrips[tripId]) return;

    setAnalyzingTrips((prev) => ({ ...prev, [tripId]: true }));
    try {
      await tripService.analyzeTrip(tripId);
      // In a real app, we might poll for status or show a toast
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      // Keep loading state for a bit to give feedback
      setTimeout(() => {
        setAnalyzingTrips((prev) => ({ ...prev, [tripId]: false }));
      }, 2000);
    }
  };

  const statusCounts = useMemo(
    () =>
      trips.reduce<Record<StatusFilter, number>>(
        (counts, trip) => {
          counts.ALL += 1;
          counts[trip.status] += 1;
          return counts;
        },
        { ALL: 0, PLANNED: 0, ONGOING: 0, COMPLETED: 0 },
      ),
    [trips],
  );

  const filteredTrips = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return trips.filter((trip) => {
      const matchesStatus =
        statusFilter === "ALL" || trip.status === statusFilter;
      const matchesSearch =
        !normalizedQuery ||
        trip.title.toLowerCase().includes(normalizedQuery) ||
        Boolean(trip.description?.toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesSearch;
    });
  }, [trips, searchQuery, statusFilter]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 overflow-x-hidden animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
            <Compass className="h-3.5 w-3.5 text-primary" />
            {trips.length} {trips.length === 1 ? "journey" : "journeys"}
          </div>
          <h2 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
            My Trips
          </h2>
          <p className="mt-1 max-w-lg text-sm text-zinc-500">
            Plan and manage your world adventures.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-11 w-full gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Trip
        </Button>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="group relative flex h-12 min-w-0 w-full items-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus-within:border-primary/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(170,59,255,0.08)]">
          <Search className="absolute left-4 h-4 w-4 shrink-0 text-zinc-500 transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search trips..."
            className="h-full min-w-0 flex-1 border-0 bg-transparent pl-11 pr-14 text-sm text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 sm:pr-32"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 flex shrink-0 items-center gap-2">
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-zinc-500 hover:bg-white/10 hover:text-white"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <span className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 sm:inline-flex">
              {filteredTrips.length}{" "}
              {filteredTrips.length === 1 ? "trip" : "trips"}
            </span>
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:hidden">
          {filteredTrips.length} {filteredTrips.length === 1 ? "trip" : "trips"}{" "}
          shown
        </p>

        <div
          className="w-full min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter trips by status"
        >
          <div className="flex w-max flex-nowrap items-center gap-2">
            {statusFilters.map((filter) => {
              const isActive = statusFilter === filter.value;
              return (
                <Button
                  key={filter.value}
                  type="button"
                  variant="ghost"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "h-9 shrink-0 snap-start rounded-xl border px-3 text-[10px] font-black uppercase tracking-wider transition-all touch-manipulation",
                    isActive
                      ? "border-primary/40 bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                      : "border-white/10 bg-white/[0.04] text-zinc-500 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      "ml-2 rounded-lg px-1.5 py-0.5 text-[9px]",
                      isActive ? "bg-white/20 text-white" : "bg-white/5",
                    )}
                  >
                    {statusCounts[filter.value]}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <Card className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-dashed border-white/10 bg-white/5 px-5 py-14 text-center transition-all hover:bg-white/[0.07]">
          <div className="mb-4 rounded-2xl bg-primary/10 p-6 transition-transform duration-500">
            <MapIcon className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {trips.length === 0 ? "No trips planned" : "No matching trips"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-6">
            {trips.length === 0
              ? "The world is waiting. Start by creating your first trip and invite your friends."
              : "Try a different search or status filter to find the journey you need."}
          </p>
          <Button
            onClick={() => {
              if (trips.length === 0) {
                setIsModalOpen(true);
                return;
              }
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            variant="outline"
            className="h-11 rounded-xl border-white/10 bg-white/5 px-6 text-xs hover:bg-white/10"
          >
            {trips.length === 0 ? "Plan First Journey" : "Clear Filters"}
          </Button>
        </Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTrips.map((trip) => (
            <Card
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}`)}
              className="group relative w-full min-w-0 max-w-full cursor-pointer touch-manipulation overflow-hidden rounded-2xl border-white/10 bg-white/5 transition-all duration-300 hover:border-primary/50 hover:bg-white/[0.07]"
            >
              <div className="relative min-w-0 aspect-[16/10] w-full overflow-hidden bg-zinc-900 sm:aspect-video">
                <TripCoverThumbnail
                  directoryId={trip.directoryId}
                  title={trip.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0810] to-transparent z-10" />
                <div className="absolute top-3 right-3 z-20 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary backdrop-blur-md">
                  {trip.status}
                </div>
              </div>
              <div className="relative p-4">
                <h4 className="line-clamp-1 text-lg font-bold text-white transition-colors group-hover:text-primary">
                  {trip.title}
                </h4>
                <p className="mt-1 line-clamp-2 min-h-9 text-sm leading-5 text-zinc-400">
                  {trip.description || "No description provided."}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-h-9 min-w-0 items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <Globe className="h-3 w-3 shrink-0" />
                      {trip.visibility}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 sm:justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-xl touch-manipulation transition-all hover:bg-primary/20 hover:text-primary sm:h-8 sm:w-auto sm:px-2",
                        analyzingTrips[trip.id] && "bg-primary/10 text-primary",
                      )}
                      onClick={(e) => handleAnalyzeTrip(e, trip.id)}
                      disabled={analyzingTrips[trip.id]}
                      aria-label={
                        analyzingTrips[trip.id]
                          ? "Analyzing trip"
                          : "Analyze trip"
                      }
                    >
                      {analyzingTrips[trip.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      <span className="hidden sm:ml-1.5 sm:inline sm:text-[9px] sm:font-black sm:uppercase sm:tracking-wider">
                        {analyzingTrips[trip.id] ? "Analyzing" : "Analyze"}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 shrink-0 rounded-xl touch-manipulation hover:bg-white/10 sm:h-8 sm:w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/trips/${trip.id}`);
                      }}
                      aria-label="Open trip"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            form.reset();
            setSelectedUsers([]);
            setSelectedGroup(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-[540px] overflow-hidden rounded-2xl border-white/10 bg-[#0a0810]/95 p-0 text-white shadow-2xl backdrop-blur-3xl sm:rounded-[2rem]">
          <DialogHeader className="p-6 bg-white/5 border-b border-white/5">
            <DialogTitle className="text-xl font-black">
              New Journey
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">
              Set the foundation for your next great adventure.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-[calc(100svh-10rem)] sm:[scrollbar-width:auto]">
            <div className="p-5 sm:p-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onTripCreate)}
                  className="space-y-6"
                >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">
                        Trip Title
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Summer in Santorini"
                          {...field}
                          className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/50 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">
                          Visibility
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#0a0810] border-white/10">
                            <SelectItem value="PRIVATE">Private</SelectItem>
                            <SelectItem value="SHARED">Shared</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">
                          Status
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#0a0810] border-white/10">
                            <SelectItem value="PLANNED">Planned</SelectItem>
                            <SelectItem value="ONGOING">Ongoing</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1 block">
                    Assign to Group
                  </label>

                  {selectedGroup ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30 px-3 py-2 gap-2 rounded-xl w-full justify-between h-11">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-bold">{selectedGroup.name}</span>
                      </div>
                      <X
                        className="h-4 w-4 cursor-pointer hover:text-white"
                        onClick={() => selectGroup(null)}
                      />
                    </Badge>
                  ) : (
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary" />
                      <Input
                        placeholder="Search for a group circle..."
                        className="bg-white/5 border-white/10 pl-10 h-11 rounded-xl focus:ring-primary/50 text-sm"
                        value={groupSearch}
                        onChange={(e) => handleGroupSearch(e.target.value)}
                      />

                      {groupResults.length > 0 && (
                        <Card className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0a0810]/98 border-white/10 shadow-2xl rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                          <ScrollArea className="h-full">
                            <div
                              className="p-3 flex items-center gap-2 hover:bg-white/5 cursor-pointer transition-colors text-zinc-400 text-xs font-bold"
                              onClick={() => selectGroup(null)}
                            >
                              <X className="h-4 w-4" />
                              None (Personal Trip)
                            </div>
                            {groupResults.map((group) => (
                              <div
                                key={group.groupId}
                                className="p-3 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => selectGroup(group)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Users className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white">
                                      {group.name}
                                    </p>
                                    <p className="text-[10px] text-zinc-500">
                                      {group.members.length} members
                                    </p>
                                  </div>
                                </div>
                                <Plus className="h-4 w-4 text-primary" />
                              </div>
                            ))}
                          </ScrollArea>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1 block">
                    Add Participants
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Badge
                        key={user.keycloakUserId}
                        className="bg-primary/20 text-primary border-primary/30 px-2 py-1 gap-1 rounded-lg"
                      >
                        {user.username}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-white"
                          onClick={() => toggleUserSelection(user)}
                        />
                      </Badge>
                    ))}
                  </div>

                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary" />
                    <Input
                      placeholder="Invite friends by username..."
                      className="bg-white/5 border-white/10 pl-10 h-11 rounded-xl focus:ring-primary/50 text-sm"
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                    />

                    {userResults.length > 0 && (
                      <Card className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0a0810]/98 border-white/10 shadow-2xl rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                        <ScrollArea className="h-full">
                          {userResults.map((user) => (
                            <div
                              key={user.keycloakUserId}
                              className="p-3 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                              onClick={() => toggleUserSelection(user)}
                            >
                              <div>
                                <p className="text-sm font-bold text-white">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  @{user.username}
                                </p>
                              </div>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          ))}
                        </ScrollArea>
                      </Card>
                    )}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="What's this trip about?"
                          {...field}
                          className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/50 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-3 border-t border-white/5 pt-4">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-11 w-full rounded-xl px-4 text-xs text-zinc-500 sm:h-10 sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createLoading}
                    className="h-11 w-full rounded-xl bg-primary px-8 text-xs font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] sm:h-10 sm:w-auto"
                  >
                    {createLoading ? "Creating..." : "Launch Trip"}
                  </Button>
                </DialogFooter>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripsPage;
