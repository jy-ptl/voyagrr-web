import { Home, Map, Image as ImageIcon, Users, Heart, Clock, PlusCircle, X, HardDrive, ChevronDown, Folder, FolderPlus, Upload, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React from "react";
import { useDriveBreadcrumbs } from "./DriveBreadcrumbContext";
import { directoryService } from "@/services/directoryService";
import { storageService } from "@/services/storageService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MetadataDialog } from "@/components/drive/MetadataDialog";

const navItems = [
  { icon: HardDrive, label: "My Drive", href: "/my-drive" },
  { icon: Map, label: "My Trips", href: "/trips" },
  { icon: Home, label: "Feed", href: "/feed", isDisabled: true },
  { icon: ImageIcon, label: "Gallery", href: "/gallery", isDisabled: true },
  { icon: Users, label: "Groups", href: "/groups" },
  { icon: Heart, label: "Favorites", href: "/favorites", isDisabled: true },
  { icon: Clock, label: "Recent", href: "/recent", isDisabled: true },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = window.location.pathname;
  const { breadcrumbs, setBreadcrumbs, childDirectories } = useDriveBreadcrumbs();
  const isDriveRoute = pathname.startsWith("/my-drive");
  const [expandedBreadcrumbIds, setExpandedBreadcrumbIds] = React.useState<Set<string | number>>(new Set(["root"]));

  const [childrenByParent, setChildrenByParent] = React.useState<Record<string, { id: string | number | null; name: string }[]>>({});
  const [hasChildrenById, setHasChildrenById] = React.useState<Record<string, boolean>>({});
  const [loadingChildrenIds, setLoadingChildrenIds] = React.useState<Set<string>>(new Set());
  
  // Context menu state
  const [contextMenuFolder, setContextMenuFolder] = React.useState<{ id: string | number | null; name: string } | null>(null);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [infoFolder, setInfoFolder] = React.useState<{ id: string | number | null; name: string } | null>(null);
  const [renameFolder, setRenameFolder] = React.useState<{ id: string | number | null; name: string } | null>(null);
  const [renameFolderName, setRenameFolderName] = React.useState("");
  const [deleteFolder, setDeleteFolder] = React.useState<{ id: string | number | null; name: string } | null>(null);
  const [isRenamingFolder, setIsRenamingFolder] = React.useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const emitDriveRefresh = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("voyagrr:drive-refresh"));
  }, []);

  const getFolderKey = React.useCallback((id: string | number | null) => (id === null ? "root" : String(id)), []);

  const areChildrenEqual = React.useCallback(
    (
      left: { id: string | number | null; name: string }[],
      right: { id: string | number | null; name: string }[],
    ) => left.length === right.length && left.every((item, index) => item.id === right[index]?.id && item.name === right[index]?.name),
    [],
  );

  const cacheChildrenForParent = React.useCallback(
    (parentId: string | number | null, children: { id: string | number | null; name: string }[]) => {
      const parentKey = getFolderKey(parentId);
      setChildrenByParent(prev => {
        if (areChildrenEqual(prev[parentKey] || [], children)) {
          return prev;
        }

        return { ...prev, [parentKey]: children };
      });

      setHasChildrenById(prev => {
        const hasChildren = children.length > 0;

        if (prev[parentKey] === hasChildren) {
          return prev;
        }

        return { ...prev, [parentKey]: hasChildren };
      });
    },
    [areChildrenEqual, getFolderKey],
  );

  const probeFolderHasChildren = React.useCallback(
    async (id: string | number | null) => {
      if (id === null) {
        return;
      }

      const folderKey = getFolderKey(id);
      if (hasChildrenById[folderKey] !== undefined || loadingChildrenIds.has(folderKey)) {
        return;
      }

      setLoadingChildrenIds(prev => new Set(prev).add(folderKey));
      try {
        const contents = await directoryService.fetchContents(id);
        const children = (contents.children || []).map(child => ({ id: child.id, name: child.name }));
        setHasChildrenById(prev => ({ ...prev, [folderKey]: children.length > 0 }));
        setChildrenByParent(prev => (prev[folderKey] ? prev : { ...prev, [folderKey]: children }));
      } catch {
        setHasChildrenById(prev => ({ ...prev, [folderKey]: false }));
      } finally {
        setLoadingChildrenIds(prev => {
          const next = new Set(prev);
          next.delete(folderKey);
          return next;
        });
      }
    },
    [getFolderKey, hasChildrenById, loadingChildrenIds],
  );

  const fetchChildrenForParent = React.useCallback(
    async (parentId: string | number | null) => {
      const parentKey = getFolderKey(parentId);

      if (childrenByParent[parentKey]) {
        return;
      }

      setLoadingChildrenIds(prev => new Set(prev).add(parentKey));
      try {
        if (parentId === null) {
          const rootItems = await directoryService.fetchRoot();
          const children = rootItems
            .filter(item => item.type === "directory")
            .map(item => ({ id: item.id, name: item.name }));
          cacheChildrenForParent(parentId, children);
          children.forEach(child => {
            void probeFolderHasChildren(child.id);
          });
          return;
        }

        const contents = await directoryService.fetchContents(parentId);
        const children = (contents.children || []).map(child => ({ id: child.id, name: child.name }));
        cacheChildrenForParent(parentId, children);
        children.forEach(child => {
          void probeFolderHasChildren(child.id);
        });
      } catch {
        cacheChildrenForParent(parentId, []);
      } finally {
        setLoadingChildrenIds(prev => {
          const next = new Set(prev);
          next.delete(parentKey);
          return next;
        });
      }
    },
    [cacheChildrenForParent, childrenByParent, getFolderKey, probeFolderHasChildren],
  );

  const toggleBreadcrumbExpansion = (id: string | number | null) => {
    const breadcrumbId = id ?? "root";
    const isOpening = !expandedBreadcrumbIds.has(breadcrumbId);

    setExpandedBreadcrumbIds(prev => {
      const next = new Set(prev);
      if (next.has(breadcrumbId)) {
        next.delete(breadcrumbId);
      } else {
        next.add(breadcrumbId);
      }
      return next;
    });

    if (isOpening) {
      void fetchChildrenForParent(id);
    }
  };

  React.useEffect(() => {
    if (!isDriveRoute) {
      return;
    }

    const visibleRoots = childDirectories;

    const walkVisibleFolders = (folders: { id: string | number | null; name: string }[]) => {
      folders.forEach(folder => {
        if (folder.id !== null) {
          void probeFolderHasChildren(folder.id);
        }

        const folderKey = getFolderKey(folder.id);
        if (!expandedBreadcrumbIds.has(folder.id ?? "root")) {
          return;
        }

        const children = childrenByParent[folderKey] || [];
        if (children.length > 0) {
          walkVisibleFolders(children);
        }
      });
    };

    walkVisibleFolders(visibleRoots);
  }, [childDirectories, childrenByParent, expandedBreadcrumbIds, getFolderKey, isDriveRoute, probeFolderHasChildren]);

  const handleRootClick = () => {
    setBreadcrumbs([{ id: null, name: "My Drive" }]);
    setExpandedBreadcrumbIds(new Set(["root"]));
    onClose?.();
  };

  const handleCreateFolder = (folder: { id: string | number | null; name: string }) => {
    setContextMenuFolder(folder);
    setIsCreateFolderDialogOpen(true);
    setNewFolderName("");
  };

  const handleFolderInfo = (folder: { id: string | number | null; name: string }) => {
    setInfoFolder(folder);
  };

  const handleFolderRename = (folder: { id: string | number | null; name: string }) => {
    setRenameFolder(folder);
    setRenameFolderName(folder.name);
  };

  const submitFolderRename = async () => {
    if (!renameFolder || !renameFolderName.trim()) return;

    const nextName = renameFolderName.trim();
    setIsRenamingFolder(true);
    try {
      setChildrenByParent(prev => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = next[key].map((item) => item.id === renameFolder.id ? { ...item, name: nextName } : item);
        });
        return next;
      });
      setBreadcrumbs(prev => prev.map((crumb) => crumb.id === renameFolder.id ? { ...crumb, name: nextName } : crumb));
      setRenameFolder(null);
      setRenameFolderName("");
      emitDriveRefresh();
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleFolderDelete = (folder: { id: string | number | null; name: string }) => {
    setDeleteFolder(folder);
  };

  const confirmFolderDelete = async () => {
    if (!deleteFolder || deleteFolder.id === null) return;

    setIsDeletingFolder(true);
    try {
      await directoryService.deleteDirectory(deleteFolder.id);
      setChildrenByParent(prev => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = next[key].filter((item) => item.id !== deleteFolder.id);
        });
        return next;
      });
      setBreadcrumbs(prev => prev.filter((crumb) => crumb.id !== deleteFolder.id));
      setHasChildrenById(prev => {
        const next = { ...prev };
        delete next[getFolderKey(deleteFolder.id)];
        return next;
      });
      setDeleteFolder(null);
      emitDriveRefresh();
    } catch (error) {
      console.error("Failed to delete folder", error);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleFolderShare = async (folder: { id: string | number | null; name: string }) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${folder.id}`);
    } catch {
      console.error("Failed to copy share link");
    }
  };

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim() || !contextMenuFolder) return;

    setIsCreatingFolder(true);
    try {
      const newFolderId = await directoryService.createDirectory(newFolderName, contextMenuFolder.id);
      
      // Update the cache with the new folder
      const folderKey = getFolderKey(contextMenuFolder.id);
      const existingChildren = childrenByParent[folderKey] || [];
      const updatedChildren = [...existingChildren, { id: newFolderId, name: newFolderName }];
      
      setChildrenByParent(prev => ({ ...prev, [folderKey]: updatedChildren }));
      setHasChildrenById(prev => ({ ...prev, [folderKey]: true }));
      
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setContextMenuFolder(null);
      emitDriveRefresh();
    } catch (error) {
      console.error("Failed to create folder", error);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUploadImage = (folder: { id: string | number | null; name: string }) => {
    setContextMenuFolder(folder);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const targetFolderId = contextMenuFolder?.id ?? activeFolderId;
      if (targetFolderId === null) return;

      await storageService.uploadFile(file, targetFolderId);
      emitDriveRefresh();
    } catch (error) {
      console.error("Failed to upload file", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setContextMenuFolder(null);
    }
  };

  const activeFolderId = breadcrumbs[breadcrumbs.length - 1]?.id ?? null;
  const activeFolderKey = getFolderKey(activeFolderId);

  const renderDirectoryRow = (
    folder: { id: string | number | null; name: string },
    depth: number,
    ancestorPath: { id: string | number | null; name: string }[],
    ancestorFolderKeys: Set<string> = new Set(),
  ) => {
    const folderKey = getFolderKey(folder.id);
    if (ancestorFolderKeys.has(folderKey)) {
      return null;
    }

    const isExpanded = expandedBreadcrumbIds.has(folder.id ?? "root");
    const hasChildren = hasChildrenById[folderKey] === true;
    const children = childrenByParent[folderKey] || [];
    const nextAncestorPath = [...ancestorPath, folder];
    const nextAncestorFolderKeys = new Set(ancestorFolderKeys);
    const isCurrentFolder = folderKey === activeFolderKey;
    const shouldHighlight = isCurrentFolder;

    nextAncestorFolderKeys.add(folderKey);

    return (
      <React.Fragment key={`${folderKey}-${depth}-${nextAncestorPath.length}`}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 14 + 10}px` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleBreadcrumbExpansion(folder.id);
              }}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                isExpanded ? "text-primary hover:bg-primary/10" : "text-zinc-700 hover:bg-white/5 hover:text-zinc-300",
              )}
              aria-label={isExpanded ? "Collapse children" : "Expand children"}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded ? "rotate-0" : "rotate-[-90deg]")} />
            </button>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <ChevronDown className="h-3.5 w-3.5 opacity-0" aria-hidden="true" />
            </div>
          )}

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setBreadcrumbs(nextAncestorPath);
                  onClose?.();
                }}
                className={cn(
                  "group flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  shouldHighlight ? "bg-primary/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Folder className={cn("h-4 w-4 shrink-0", shouldHighlight ? "text-primary" : "text-zinc-500")} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52 bg-[#0a0810]/98 backdrop-blur-xl border-white/10 text-white rounded-lg p-1 shadow-2xl animate-in zoom-in-95 duration-200">
              <ContextMenuItem
                onClick={() => handleCreateFolder(folder)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Create Folder</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleUploadImage(folder)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Upload File</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleFolderInfo(folder)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="h-4 w-4 rounded-full border border-zinc-500 text-[9px] leading-4 text-center font-bold">i</span>
                <span>Info</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleFolderRename(folder)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
                <span>Rename</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleFolderShare(folder)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="h-4 w-4 rounded-full border border-zinc-500 text-[9px] leading-4 text-center font-bold">↗</span>
                <span>Share</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleFolderDelete(folder)}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>

        {isExpanded && children.length > 0 && (
          <div className="space-y-1">
            {children.map((child) => renderDirectoryRow(child, depth + 1, nextAncestorPath, nextAncestorFolderKeys))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen w-72 border-r border-white/5 bg-[#0a0810]/80 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6">
          <button type="button" onClick={() => { onClose?.(); window.location.href = "/"; }} className="flex items-center gap-3">
            <img src="/favicon.svg" alt="VOYAGRR" className="h-9 w-9 drop-shadow-[0_0_18px_rgba(134,59,255,0.45)]" />
            <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              VOYAGRR
            </h1>
          </button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex h-[calc(100%-4rem)] flex-col justify-between p-4">
          <div className="space-y-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const content = (
                <Button
                  variant="ghost"
                  disabled={item.isDisabled}
                  className={cn(
                    "w-full justify-start gap-3 text-sm font-medium transition-all duration-300 relative group h-11 px-4 rounded-xl",
                    isActive 
                      ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5",
                    item.isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-zinc-400"
                  )}
                  onClick={
                    item.isDisabled
                      ? undefined
                      : () => {
                          if (item.label === "My Drive") {
                            handleRootClick();
                            window.location.href = item.href;
                            return;
                          }

                          window.location.href = item.href;
                          onClose?.();
                        }
                  }
                >
                  {isActive && (
                    <span className="absolute left-0 h-6 w-1 rounded-r-full bg-primary shadow-[0_0_15px_rgba(170,59,255,0.8)]" />
                  )}
                  <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-primary"
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.isDisabled && (
                    <span className="text-[8px] font-black uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5 text-zinc-600">
                      Soon
                    </span>
                  )}
                </Button>
              );

              if (item.label === "My Drive") {
                const rootChildren = childDirectories;

                return (
                  <div key={item.label} className="space-y-1">
                    {content}

                    {isDriveRoute && (
                      <div className="ml-6 space-y-1 border-l border-white/5 pl-3">
                        {rootChildren.map((child) => renderDirectoryRow(child, 0, [{ id: null, name: "My Drive" }], new Set(["root"]))) }
                      </div>
                    )}
                  </div>
                );
              }

              if (item.isDisabled) {
                return <div key={item.label}>{content}</div>;
              }

              return <React.Fragment key={item.label}>{content}</React.Fragment>;
            })}

          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Storage</p>
                <p className="text-[10px] text-zinc-500">65% used</p>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800">
                <div 
                  className="h-1.5 rounded-full bg-gradient-to-r from-primary to-purple-500 shadow-[0_0_10px_rgba(170,59,255,0.4)]" 
                  style={{ width: '65%' }}
                />
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">6.5 GB of 10 GB used</p>
            </div>
            
            <Button onClick={() => fileInputRef.current?.click()} className="w-full gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] h-11">
              <PlusCircle className="h-4 w-4" />
              Upload Media
            </Button>
          </div>
        </div>
      </aside>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={(open) => {
        setIsCreateFolderDialogOpen(open);
        if (!open) {
          setContextMenuFolder(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in <strong>{contextMenuFolder?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateFolderSubmit();
                }
              }}
              disabled={isCreatingFolder}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderDialogOpen(false)}
              disabled={isCreatingFolder}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolderSubmit}
              disabled={isCreatingFolder || !newFolderName.trim()}
            >
              {isCreatingFolder ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameFolder} onOpenChange={(open) => !open && setRenameFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Update the label for <strong>{renameFolder?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="New folder name"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              disabled={isRenamingFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void submitFolderRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolder(null)} disabled={isRenamingFolder}>
              Cancel
            </Button>
            <Button onClick={() => void submitFolderRename()} disabled={isRenamingFolder || !renameFolderName.trim()}>
              {isRenamingFolder ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MetadataDialog
        isOpen={!!infoFolder}
        onClose={() => setInfoFolder(null)}
        item={infoFolder ? { name: infoFolder.name, type: "directory" } : null}
        metadata={null}
      />

      <AlertDialog open={!!deleteFolder} onOpenChange={(open) => !open && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteFolder?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmFolderDelete()} disabled={isDeletingFolder}>
              {isDeletingFolder ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
};
