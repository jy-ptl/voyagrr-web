import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { cn } from "@/lib/utils";
import { Plus, Map, Globe, Search, ArrowRight, Users, Sparkles, Loader2 } from "lucide-react";
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

// Services & Types
import { tripService } from "@/services/tripService";
import { groupService, type Group } from "@/services/groupService";
import { userService, type UserSearchResponse } from "@/services/userService";
import type { Trip, TripCreateRequest } from "@/types/trips";
import { X } from "lucide-react";
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

const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // User Search State
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResponse[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResponse[]>([]);

  // Group Search State
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Analysis State
  const [analyzingTrips, setAnalyzingTrips] = useState<Record<number, boolean>>({});

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

  const handleUserSearch = useCallback(async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
    try {
      const results = await userService.searchUsers(query);
      setUserResults(results.filter(r => !selectedUsers.find(s => s.keycloakUserId === r.keycloakUserId)));
    } catch (error) {
      console.error("User search failed", error);
    }
  }, [selectedUsers]);

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
    const isSelected = selectedUsers.find(s => s.keycloakUserId === user.keycloakUserId);
    let newSelection;
    if (isSelected) {
      newSelection = selectedUsers.filter(s => s.keycloakUserId !== user.keycloakUserId);
    } else {
      newSelection = [...selectedUsers, user];
    }
    setSelectedUsers(newSelection);
    form.setValue("keycloakUserIds", newSelection.map(u => u.keycloakUserId));
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
      setTrips(prev => [...prev, newTrip]);
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

    setAnalyzingTrips(prev => ({ ...prev, [tripId]: true }));
    try {
      await tripService.analyzeTrip(tripId);
      // In a real app, we might poll for status or show a toast
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      // Keep loading state for a bit to give feedback
      setTimeout(() => {
        setAnalyzingTrips(prev => ({ ...prev, [tripId]: false }));
      }, 2000);
    }
  };

  const filteredTrips = useMemo(() => trips.filter(trip => 
    trip.title.toLowerCase().includes(searchQuery.toLowerCase())
  ), [trips, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-0.5">My Trips</h2>
          <p className="text-xs text-zinc-500">Plan and manage your world adventures.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-10 px-5 gap-2 rounded-xl text-sm"
        >
          <Plus className="h-4 w-4" />
          Create Trip
        </Button>
      </div>

      <div className="relative group max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Search your journeys..." 
          className="bg-white/5 border-white/10 pl-10 h-11 text-sm focus-visible:ring-primary/50 transition-all rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border-dashed border-white/10 rounded-2xl group transition-all hover:bg-white/[0.07]">
          <div className="rounded-2xl bg-primary/10 p-6 mb-4 group-hover:scale-105 transition-transform duration-500">
            <Map className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">No trips planned</h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-6">
            The world is waiting. Start by creating your first trip and invite your friends.
          </p>
          <Button 
            onClick={() => setIsModalOpen(true)}
            variant="outline" 
            className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-6 rounded-xl text-xs"
          >
            Plan First Journey
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => (
            <Card 
              key={trip.id} 
              onClick={() => navigate(`/trips/${trip.id}`)}
              className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-primary/50 transition-all duration-300 rounded-2xl cursor-pointer"
            >
              <div className="aspect-video w-full bg-zinc-900 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0810] to-transparent z-10" />
                <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-black text-primary uppercase tracking-widest">
                  {trip.status}
                </div>
              </div>
              <div className="p-4 relative">
                <h4 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{trip.title}</h4>
                <p className="text-xs text-zinc-400 line-clamp-2 mb-3 h-8">{trip.description || "No description provided."}</p>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />
                      {trip.visibility}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "h-8 px-2 rounded-lg hover:bg-primary/20 hover:text-primary transition-all gap-1.5 text-[9px] font-black uppercase tracking-widest",
                        analyzingTrips[trip.id] && "text-primary bg-primary/10"
                      )}
                      onClick={(e) => handleAnalyzeTrip(e, trip.id)}
                      disabled={analyzingTrips[trip.id]}
                    >
                      {analyzingTrips[trip.id] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {analyzingTrips[trip.id] ? "Analyzing" : "Analyze"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg hover:bg-white/10" onClick={(e) => { e.stopPropagation(); navigate(`/trips/${trip.id}`); }}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal remains same but uses form.handleSubmit(onTripCreate) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          form.reset();
          setSelectedUsers([]);
          setSelectedGroup(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 bg-white/5 border-b border-white/5">
            <DialogTitle className="text-xl font-black">New Journey</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">Set the foundation for your next great adventure.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onTripCreate)} className="space-y-6">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Trip Title</FormLabel>
                    <FormControl><Input placeholder="Summer in Santorini" {...field} className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/50 text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="visibility" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Visibility</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-[#0a0810] border-white/10">
                          <SelectItem value="PRIVATE">Private</SelectItem>
                          <SelectItem value="SHARED">Shared</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl text-xs"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-[#0a0810] border-white/10">
                          <SelectItem value="PLANNED">Planned</SelectItem>
                          <SelectItem value="ONGOING">Ongoing</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-4">
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1 block">Assign to Group</label>
                  
                  {selectedGroup ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30 px-3 py-2 gap-2 rounded-xl w-full justify-between h-11">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-bold">{selectedGroup.name}</span>
                      </div>
                      <X className="h-4 w-4 cursor-pointer hover:text-white" onClick={() => selectGroup(null)} />
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
                            {groupResults.map(group => (
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
                                    <p className="text-sm font-bold text-white">{group.name}</p>
                                    <p className="text-[10px] text-zinc-500">{group.members.length} members</p>
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
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1 block">Add Participants</label>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <Badge key={user.keycloakUserId} className="bg-primary/20 text-primary border-primary/30 px-2 py-1 gap-1 rounded-lg">
                        {user.username}
                        <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => toggleUserSelection(user)} />
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
                          {userResults.map(user => (
                            <div 
                              key={user.keycloakUserId}
                              className="p-3 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                              onClick={() => toggleUserSelection(user)}
                            >
                              <div>
                                <p className="text-sm font-bold text-white">{user.firstName} {user.lastName}</p>
                                <p className="text-[10px] text-zinc-500">@{user.username}</p>
                              </div>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          ))}
                        </ScrollArea>
                      </Card>
                    )}
                  </div>
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Description</FormLabel>
                    <FormControl><Input placeholder="What's this trip about?" {...field} className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/50 text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter className="pt-4 border-t border-white/5">
                  <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-500 h-10 px-4 rounded-xl text-xs">Cancel</Button>
                  <Button type="submit" disabled={createLoading} className="bg-primary text-white shadow-xl shadow-primary/20 h-10 px-8 rounded-xl font-bold text-xs transition-all hover:scale-[1.02]">
                    {createLoading ? "Creating..." : "Launch Trip"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripsPage;
