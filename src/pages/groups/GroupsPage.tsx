import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Plus, Users, Search, Trash2, ArrowRight, UserPlus } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Services & Types
import { groupService, type Group, type GroupCreateRequest } from "@/services/groupService";
import { userService, type UserSearchResponse } from "@/services/userService";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const groupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters").max(50),
  members: z.array(z.string()).min(1, "Please select at least one member"),
});

type GroupValues = z.infer<typeof groupSchema>;

export const GroupsPage = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  
  // User Search State
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResponse[]>([]);

  const form = useForm<GroupValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      members: [],
    },
  });

  const handleUserSearch = useCallback(async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await userService.searchUsers(query);
      // Filter out already selected users
      setUserResults(results.filter(r => !selectedUsers.find(s => s.keycloakUserId === r.keycloakUserId)));
    } catch (error) {
      console.error("User search failed", error);
    } finally {
      setSearching(false);
    }
  }, [selectedUsers]);

  const toggleUserSelection = (user: UserSearchResponse) => {
    const isSelected = selectedUsers.find(s => s.keycloakUserId === user.keycloakUserId);
    let newSelection;
    if (isSelected) {
      newSelection = selectedUsers.filter(s => s.keycloakUserId !== user.keycloakUserId);
    } else {
      newSelection = [...selectedUsers, user];
    }
    setSelectedUsers(newSelection);
    form.setValue("members", newSelection.map(u => u.keycloakUserId));
    setUserSearch("");
    setUserResults([]);
  };

  const fetchGroups = useCallback(async () => {
    try {
      const data = await groupService.fetchGroups();
      setGroups(data || []);
    } catch (error) {
      console.error("Failed to fetch groups", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchGroups();
    });
  }, [fetchGroups]);

  const onGroupCreate = async (values: GroupValues) => {
    setCreateLoading(true);
    try {
      const newGroup = await groupService.createGroup(values as GroupCreateRequest);
      setGroups(prev => [...prev, newGroup]);
      setIsModalOpen(false);
      form.reset();
      setSelectedUsers([]);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to create group", error.response?.data);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const onGroupDelete = async () => {
    if (!groupToDelete) return;
    try {
      await groupService.deleteGroup(groupToDelete.groupId);
      setGroups(prev => prev.filter(g => g.groupId !== groupToDelete.groupId));
      setGroupToDelete(null);
    } catch (error) {
      console.error("Failed to delete group", error);
    }
  };

  const filteredGroups = useMemo(() => groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [groups, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-0.5">Community Groups</h2>
          <p className="text-xs text-zinc-500">Collaborate and share memories with your travel circles.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-10 px-5 gap-2 rounded-xl text-sm"
        >
          <UserPlus className="h-4 w-4" />
          New Group
        </Button>
      </div>

      <div className="relative group max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Find your circles..." 
          className="bg-white/5 border-white/10 pl-10 h-11 text-sm focus-visible:ring-primary/50 transition-all rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border-dashed border-white/10 rounded-2xl group transition-all hover:bg-white/[0.07]">
          <div className="rounded-2xl bg-primary/10 p-6 mb-4 group-hover:scale-105 transition-transform duration-500">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">No groups found</h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-6">
            Travel is better together. Create a group to start sharing trips and media with friends.
          </p>
          <Button 
            onClick={() => setIsModalOpen(true)}
            variant="outline" 
            className="border-white/10 bg-white/5 hover:bg-white/10 h-10 px-6 rounded-xl text-xs"
          >
            Create Your First Group
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <Card 
              key={group.groupId} 
              className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-primary/50 transition-all duration-300 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                  <Users className="h-6 w-6" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-500 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  onClick={() => setGroupToDelete(group)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <h4 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{group.name}</h4>
              <p className="text-xs text-zinc-400 line-clamp-2 h-8 mb-4">{group.description || "No description provided."}</p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 w-6 rounded-full border-2 border-[#0a0810] bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                      U{i}
                    </div>
                  ))}
                  <div className="h-6 w-6 rounded-full border-2 border-[#0a0810] bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                    +5
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg hover:bg-white/10">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          form.reset();
          setSelectedUsers([]);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 bg-white/5 border-b border-white/5">
            <DialogTitle className="text-xl font-black">Create Circle</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">Start a new group to collaborate on your journeys.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onGroupCreate)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Group Name</FormLabel>
                    <FormControl><Input placeholder="Backpackers United" {...field} className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/50 text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-4">
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1 block">Add Members</label>
                  
                  {/* Selected Members Chips */}
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
                      placeholder="Search by username or email..." 
                      className="bg-white/5 border-white/10 pl-10 h-11 rounded-xl focus:ring-primary/50 text-sm"
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                    />
                    
                    {/* Search Results Dropdown */}
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
                    {searching && userSearch.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0a0810]/98 border-white/10 p-3 text-center rounded-xl">
                        <p className="text-xs text-zinc-500 animate-pulse">Searching explorers...</p>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="pt-4 border-t border-white/5">
                  <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-500 h-10 px-4 rounded-xl text-xs">Cancel</Button>
                  <Button type="submit" disabled={createLoading} className="bg-primary text-white shadow-xl shadow-primary/20 h-10 px-8 rounded-xl font-bold text-xs transition-all hover:scale-[1.02]">
                    {createLoading ? "Creating..." : "Create Circle"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent className="bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">Dissolve Circle?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-400">
              Are you sure you want to delete <span className="text-white font-bold">"{groupToDelete?.name}"</span>? This action cannot be undone and all group collaborations will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl"
              onClick={onGroupDelete}
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupsPage;
