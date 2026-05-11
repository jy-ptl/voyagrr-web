import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Folder, Search, MoreVertical, LayoutGrid, List as ListIcon, ChevronRight, Plus, FolderPlus, Pencil, Trash2, Info, Upload, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDispatch } from "react-redux";
import { clearAuth } from "@/store/slices/authSlice";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { MetadataDialog } from "@/components/drive/MetadataDialog";
import { FileThumbnail } from "@/components/drive/FileThumbnail";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

// Services & Types
import { directoryService } from "@/services/directoryService";
import { storageService } from "@/services/storageService";
import { metadataService } from "@/services/metadataService";
import type { DirectoryItem, FileMetadata } from "@/types/drive";


const folderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
});

type FolderValues = z.infer<typeof folderSchema>;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const MyDrivePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // UI State
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | number | null; name: string }[]>([
    { id: null, name: 'My Drive' }
  ]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection & Info State
  const [itemToDelete, setItemToDelete] = useState<DirectoryItem | null>(null);
  const [itemInfo, setItemInfo] = useState<{ item: DirectoryItem, metadata: FileMetadata } | null>(null);
  const [metadataMap, setMetadataMap] = useState<Record<string | number, FileMetadata>>({});
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string, progress: number } | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];
  const currentFolderId = currentFolder?.id;

  const form = useForm<FolderValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: "" },
  });

  const handleLogout = useCallback(() => {
    dispatch(clearAuth());
    navigate("/login");
  }, [dispatch, navigate]);

  /**
   * Main data fetching logic
   */
  const fetchData = useCallback(async (folderId?: string | number | null) => {
    setLoading(true);
    setError(null);
    try {
      if (!folderId) {
        // Fetch Root
        const rootItems = await directoryService.fetchRoot();
        setItems(rootItems);
        setPermissions(['EDIT']); 
        setMetadataMap({});
      } else {
        // Fetch Directory Contents
        const contents = await directoryService.fetchContents(folderId);
        setPermissions(contents.permission || []);
        
        const combinedItems: DirectoryItem[] = [
          ...(contents.children || []).map(child => ({ ...child, type: 'directory' as const })),
          ...(contents.files || []).map(file => ({ ...file, type: 'file' as const }))
        ];
        setItems(combinedItems);

        // Batch Fetch Metadata
        try {
          const metaResponses = await metadataService.getDirectoryMetadata(folderId);
          const newMap: Record<string | number, FileMetadata> = {};
          metaResponses.forEach((m) => {
            newMap[m.fileId] = m.metadata as FileMetadata;
          });
          setMetadataMap(newMap);
        } catch (mErr) {
          console.warn("Failed to fetch batch metadata", mErr);
        }
      }
    } catch (err) {
      console.error("Failed to fetch directory:", err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData(currentFolderId);
    });
  }, [currentFolderId, fetchData]);

  const navigateTo = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleFolderClick = (item: DirectoryItem) => {
    if (item.type === 'directory') {
      setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    }
  };

  const onFolderCreate = async (values: FolderValues) => {
    setCreateLoading(true);
    setError(null);
    try {
      await directoryService.createDirectory(values.name, currentFolderId);
      form.reset();
      setIsFolderModalOpen(false);
      setIsFabOpen(false);
      fetchData(currentFolderId);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to create folder");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesArray = Array.from(selectedFiles);
    const oversizedFiles = filesArray.filter(file => file.size > MAX_FILE_SIZE);

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
        await storageService.uploadFile(filesArray[0], currentFolderId, onProgress);
      } else {
        await storageService.uploadFilesBatch(filesArray, currentFolderId, onProgress);
      }
      setIsFabOpen(false);
      fetchData(currentFolderId);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Upload failed");
      }
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'directory') {
        await directoryService.deleteDirectory(itemToDelete.id);
      } else {
        await storageService.deleteFile(itemToDelete.id);
      }
      setItemToDelete(null);
      fetchData(currentFolderId);
    } catch {
      setError("Failed to delete item");
    } finally {
      setItemToDelete(null);
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

  const filteredItems = useMemo(() => items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [items, searchQuery]);

  const canUpload = permissions.includes('UPLOAD') && currentFolderId !== null;

  return (
    <div className="max-w-6xl mx-auto space-y-4 relative min-h-[calc(100vh-8rem)] animate-in fade-in duration-700">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center flex-wrap gap-1.5 overflow-hidden">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-3 w-3 text-zinc-700 shrink-0" />}
              <button
                onClick={() => navigateTo(index)}
                disabled={index === breadcrumbs.length - 1}
                className={cn(
                  "text-sm font-bold transition-all truncate max-w-[150px] outline-none",
                  index === breadcrumbs.length - 1 
                    ? "text-white cursor-default" 
                    : "text-zinc-500 hover:text-primary cursor-pointer"
                )}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* View Switcher */}
        <div className="flex items-center p-0.5 bg-white/5 rounded-lg border border-white/5 w-fit">
          <Button 
            variant="ghost" 
            size="sm"
            className={cn(
              "h-7 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
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
              "h-7 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              view === 'list' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )} 
            onClick={() => setView('list')}
          >
            <ListIcon className="h-3 w-3 mr-1.5" />
            List
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative group max-w-md ml-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Search collections..." 
          className="bg-white/5 border-white/10 pl-10 h-10 text-xs focus-visible:ring-primary/50 transition-all rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Items Display */}
      <div className="px-1 min-h-[400px]">
        {loading ? (
          <div className={cn(
            "grid gap-4",
            view === 'grid' ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"
          )}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className={cn("bg-white/5 rounded-xl", view === 'grid' ? "h-32" : "h-14")} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <Folder className="h-12 w-12 text-zinc-600 mb-4 stroke-1" />
            <p className="text-sm font-medium text-zinc-500">This collection is empty</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            view === 'grid' ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => {
                const meta = metadataMap[item.id];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.01 }}
                    layout
                  >
                    <Card 
                      onClick={() => handleFolderClick(item)}
                      className={cn(
                        "group relative border-white/5 bg-white/5 transition-all duration-300 hover:bg-white/10 cursor-pointer overflow-hidden rounded-xl shadow-sm hover:shadow-primary/5 hover:border-primary/20 flex",
                        view === 'grid' ? "p-3 flex-col items-center text-center gap-3" : "p-2 px-3 items-center justify-between h-14"
                      )}
                    >
                      <div className={cn("flex items-center gap-3 min-w-0", view === 'grid' ? "flex-col w-full" : "flex-row")}>
                        <FileThumbnail 
                          fileId={item.id} 
                          type={item.type} 
                          className={view === 'grid' ? "h-16 w-16 sm:h-20 sm:w-20 shrink-0" : "h-10 w-10 shrink-0"}
                        />
                        <div className="overflow-hidden">
                          <p className={cn(
                            "truncate text-[11px] font-bold text-white group-hover:text-primary transition-colors",
                            view === 'grid' ? "text-center" : "text-left"
                          )}>
                            {item.name}
                          </p>
                          <div className={cn(
                            "flex items-center gap-2 mt-0.5 opacity-60",
                            view === 'grid' ? "justify-center" : "justify-start"
                          )}>
                            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em]">
                              {item.type}
                            </p>
                            {meta?.analysis?.scene && (
                              <p className="text-[8px] text-primary font-black uppercase tracking-widest hidden sm:block">
                                • {meta.analysis.scene}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className={cn(
                        view === 'grid' ? "absolute top-1 right-1" : "relative ml-2"
                      )}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 rounded-md text-zinc-600 transition-all hover:bg-white/5 hover:text-white",
                                view === 'grid' ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#0a0810]/98 backdrop-blur-xl border-white/10 text-white rounded-lg p-1 shadow-2xl animate-in zoom-in-95 duration-200">
                            <DropdownMenuItem className="rounded-md h-8 gap-2 focus:bg-white/5 cursor-pointer text-[10px] font-bold uppercase tracking-wider" onClick={(e) => { e.stopPropagation(); setItemInfo({ item, metadata: meta || {} }); }}>
                              <Info className="h-3 w-3 text-zinc-500" />
                              <span>Info</span>
                            </DropdownMenuItem>
                            {item.type === 'file' && (
                              <DropdownMenuItem className="rounded-md h-8 gap-2 focus:bg-white/5 cursor-pointer text-[10px] font-bold uppercase tracking-wider" onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                                <Download className="h-3 w-3 text-zinc-500" />
                                <span>Download</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="rounded-md h-8 gap-2 focus:bg-white/5 cursor-pointer text-[10px] font-bold uppercase tracking-wider" onClick={(e) => e.stopPropagation()}>
                              <Pencil className="h-3 w-3 text-zinc-500" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="rounded-md h-8 gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-[10px] font-bold uppercase tracking-wider" 
                              onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* FAB & Modals */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-4 z-50">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="flex flex-col items-end gap-3 mb-2"
            >
              {canUpload && (
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
              )}
              <div className="group relative flex items-center gap-3">
                <span className="opacity-0 group-hover:opacity-100 transition-all absolute right-16 whitespace-nowrap rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl border border-white/10 shadow-2xl translate-x-2 group-hover:translate-x-0">
                  New Folder
                </span>
                <Button 
                  size="icon" 
                  className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 text-primary hover:bg-white/10 hover:border-primary/50 shadow-2xl transition-all hover:scale-110 active:scale-95"
                  onClick={() => setIsFolderModalOpen(true)}
                >
                  <FolderPlus className="h-6 w-6" />
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
        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={onFileUpload} />
      </div>

      {/* Modals & Dialogs */}
      <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden shadow-2xl border-t-white/10">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <DialogHeader className="p-8 pb-4 relative z-10">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg">
                <FolderPlus className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight">Create Collection</DialogTitle>
                <DialogDescription className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Organize your workspace</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-4 relative z-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFolderCreate)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormControl>
                        <Input 
                          placeholder="Collection Name..." 
                          className="h-12 bg-white/5 border-white/10 rounded-xl px-4 text-sm font-medium focus:border-primary/50 transition-all text-center placeholder:text-zinc-700" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] text-center" />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-row gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsFolderModalOpen(false)} className="flex-1 h-12 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                  <Button type="submit" disabled={createLoading} className="flex-1 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl">
                    {createLoading ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-[2.5rem] p-8 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Hold on!</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-lg leading-relaxed mt-4">
              Are you sure you want to delete <span className="font-black text-white">"{itemToDelete?.name}"</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">Go Back</AlertDialogCancel>
            <Button onClick={confirmDelete} className="h-14 rounded-2xl bg-destructive text-white hover:bg-destructive/90 shadow-2xl shadow-destructive/20 font-bold px-8">Yes, Delete Forever</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MetadataDialog 
        isOpen={!!itemInfo} 
        onClose={() => setItemInfo(null)}
        item={itemInfo?.item || null}
        metadata={itemInfo?.metadata || null}
      />

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
