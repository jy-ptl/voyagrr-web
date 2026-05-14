import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Folder,
  File as FileIcon,
  Search,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  Plus,
  FolderPlus,
  Pencil,
  Trash2,
  Info,
  Upload,
  Download,
  Loader2,
  Share2,
  X,
} from "lucide-react";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { motion, AnimatePresence } from "framer-motion";

// Services & Types
import { directoryService } from "@/services/directoryService";
import { storageService } from "@/services/storageService";
import { metadataService } from "@/services/metadataService";
import type { DirectoryItem, FileMetadata } from "@/types/drive";

import { useDriveBreadcrumbs } from "@/components/layout/DriveBreadcrumbContext";

const folderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
});

type FolderValues = z.infer<typeof folderSchema>;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const MyDrivePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    breadcrumbs,
    setBreadcrumbs,
    setChildDirectories,
    setChildDirectoriesFolderId,
  } = useDriveBreadcrumbs();

  // UI State
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<
    string | number | null
  >(null);
  const [createFolderParentName, setCreateFolderParentName] = useState<
    string | null
  >(null);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<
    string | number | null
  >(null);
  const [renameTarget, setRenameTarget] = useState<DirectoryItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection & Info State
  const [itemToDelete, setItemToDelete] = useState<DirectoryItem | null>(null);
  const [itemInfo, setItemInfo] = useState<{
    item: DirectoryItem;
    metadata: FileMetadata;
  } | null>(null);
  const [metadataMap, setMetadataMap] = useState<
    Record<string | number, FileMetadata>
  >({});
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const emitDriveRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("voyagrr:drive-refresh"));
  }, []);

  useEffect(() => {
    setBreadcrumbs([{ id: null, name: "My Drive" }]);
  }, [setBreadcrumbs]);

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
  const fetchData = useCallback(
    async (folderId?: string | number | null) => {
      setLoading(true);
      setError(null);
      try {
        if (!folderId) {
          // Fetch Root
          const rootItems = await directoryService.fetchRoot();
          setItems(rootItems);
          setPermissions(["EDIT"]);
          setMetadataMap({});
          setChildDirectories(
            rootItems
              .filter((item) => item.type !== "file")
              .map((item) => ({ id: item.id, name: item.name })),
          );
          setChildDirectoriesFolderId(null);
        } else {
          // Fetch Directory Contents
          const contents = await directoryService.fetchContents(folderId);
          setPermissions(contents.permission || []);

          const combinedItems: DirectoryItem[] = [
            ...(contents.children || []).map((child) => ({
              ...child,
              type: "directory" as const,
            })),
            ...(contents.files || []).map((file) => ({
              ...file,
              type: "file" as const,
            })),
          ];
          setItems(combinedItems);
          setChildDirectories(
            (contents.children || []).map((child) => ({
              id: child.id,
              name: child.name,
            })),
          );
          setChildDirectoriesFolderId(folderId);

          // Batch Fetch Metadata
          try {
            const metaResponses =
              await metadataService.getDirectoryMetadata(folderId);
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
    },
    [handleLogout],
  );

  const uploadFiles = useCallback(
    async (files: File[], directoryId: string | number | null) => {
      if (!files.length || directoryId === null) return;

      setUploadingFiles(true);
      setError(null);
      try {
        await Promise.all(
          files.map((file) => storageService.uploadFile(file, directoryId)),
        );
        setIsFabOpen(false);
        fetchData(directoryId);
        emitDriveRefresh();
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || "Upload failed");
        } else {
          setError("Upload failed");
        }
      } finally {
        setUploadingFiles(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [emitDriveRefresh, fetchData],
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData(currentFolderId);
    });
  }, [currentFolderId, fetchData]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchData(currentFolderId);
    };

    window.addEventListener("voyagrr:drive-refresh", handleRefresh);
    return () =>
      window.removeEventListener("voyagrr:drive-refresh", handleRefresh);
  }, [currentFolderId, fetchData]);

  const navigateTo = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleFolderClick = (item: DirectoryItem) => {
    if (item.type === "directory") {
      setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
    }
  };

  const onFolderCreate = async (values: FolderValues) => {
    setCreateLoading(true);
    setError(null);
    try {
      const targetFolderId =
        createFolderParentId !== null ? createFolderParentId : currentFolderId;
      await directoryService.createDirectory(values.name, targetFolderId);
      form.reset();
      setIsFolderModalOpen(false);
      setIsFabOpen(false);
      setCreateFolderParentId(null);
      setCreateFolderParentName(null);
      fetchData(targetFolderId);
      emitDriveRefresh();
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
    const oversizedFiles = filesArray.filter(
      (file) => file.size > MAX_FILE_SIZE,
    );

    if (oversizedFiles.length > 0) {
      setError(
        `Some files are too large (max 10MB): ${oversizedFiles.map((f) => f.name).join(", ")}`,
      );
      return;
    }

    const targetFolderId =
      uploadTargetFolderId !== null ? uploadTargetFolderId : currentFolderId;
    await uploadFiles(filesArray, targetFolderId);
    setUploadTargetFolderId(null);
  };

  const handleRename = (item: DirectoryItem) => {
    setRenameTarget(item);
    setRenameValue(item.name);
  };

  const openCreateFolderModal = (targetFolderId: string | number | null) => {
    setCreateFolderParentId(targetFolderId);
    setCreateFolderParentName(
      targetFolderId === null
        ? currentFolder?.name || "My Drive"
        : items.find((item) => item.id === targetFolderId)?.name ||
            currentFolder?.name ||
            "My Drive",
    );
    setIsFolderModalOpen(true);
  };

  const startUploadForFolder = (targetFolderId: string | number | null) => {
    setUploadTargetFolderId(targetFolderId);
    fileInputRef.current?.click();
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;

    setRenameLoading(true);
    try {
      const nextName = renameValue.trim();
      setItems((prev) =>
        prev.map((item) =>
          item.id === renameTarget.id ? { ...item, name: nextName } : item,
        ),
      );
      setChildDirectories((prev) =>
        prev.map((item) =>
          item.id === renameTarget.id ? { ...item, name: nextName } : item,
        ),
      );
      setBreadcrumbs((prev) =>
        prev.map((item) =>
          item.id === renameTarget.id ? { ...item, name: nextName } : item,
        ),
      );
      if (currentFolderId === renameTarget.id) {
        setBreadcrumbs((prev) =>
          prev.map((item) =>
            item.id === renameTarget.id ? { ...item, name: nextName } : item,
          ),
        );
      }
      emitDriveRefresh();
      setRenameTarget(null);
    } finally {
      setUploadProgress(null);
      setRenameLoading(false);
    }
  };

  const handleShare = async (item: DirectoryItem) => {
    const shareText = `${window.location.origin}${window.location.pathname}#${item.id}`;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      setError("Copy link failed");
    }
  };

  const canUpload = permissions.includes("UPLOAD") && currentFolderId !== null;

  const handleDropUpload = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);

      if (!canUpload) return;

      const files = Array.from(event.dataTransfer.files || []);
      if (files.length === 0) return;

      await uploadFiles(files, currentFolderId);
    },
    [canUpload, currentFolderId, uploadFiles],
  );

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const isDeletingCurrentDirectory =
      itemToDelete.type === "directory" && itemToDelete.id === currentFolderId;
    const parentFolderId = breadcrumbs[breadcrumbs.length - 2]?.id ?? null;

    try {
      if (itemToDelete.type === "directory") {
        await directoryService.deleteDirectory(itemToDelete.id);
      } else {
        await storageService.deleteFile(itemToDelete.id);
      }
      setItemToDelete(null);
      if (isDeletingCurrentDirectory) {
        setBreadcrumbs((prev) => prev.slice(0, -1));
        fetchData(parentFolderId);
      } else {
        fetchData(currentFolderId);
      }
    } catch {
      setError("Failed to delete item");
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDownload = async (item: DirectoryItem) => {
    if (item.type !== "file") return;
    try {
      const blob = await storageService.downloadFile(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", item.name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download file");
    }
  };

  const currentDirectoryItem = useMemo<DirectoryItem | null>(() => {
    if (currentFolderId === null || currentFolderId === undefined) return null;
    return {
      id: currentFolderId,
      name: currentFolder?.name || "Folder",
      type: "directory",
    };
  }, [currentFolderId, currentFolder?.name]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [items, searchQuery],
  );

  const actionMenuClassName =
    "bg-[#0a0810]/98 backdrop-blur-xl border-white/10 text-white rounded-lg p-1 shadow-2xl animate-in zoom-in-95 duration-200";
  const actionMenuItemClassName =
    "rounded-md h-8 gap-2 focus:bg-white/5 cursor-pointer text-[10px] font-bold uppercase tracking-wider";
  const contextMenuClassName =
    "w-64 overflow-hidden rounded-2xl border-white/10 bg-[#0a0810]/95 p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl animate-in fade-in-0 zoom-in-95 duration-150";
  const contextMenuItemClassName =
    "h-10 rounded-xl gap-3 px-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 cursor-pointer transition-colors focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white";
  const contextMenuIconClassName =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-400";
  const contextMenuDangerItemClassName =
    "h-10 rounded-xl gap-3 px-2.5 text-[11px] font-bold uppercase tracking-wider text-destructive cursor-pointer transition-colors focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive";

  const renderActionMenuItems = (
    item: DirectoryItem,
    meta: FileMetadata | undefined,
  ) => (
    <>
      <ContextMenuItem
        className={contextMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          setItemInfo({ item, metadata: meta || {} });
        }}
      >
        <span className={contextMenuIconClassName}>
          <Info className="h-3.5 w-3.5" />
        </span>
        <span>Info</span>
      </ContextMenuItem>

      {item.type === "file" && (
        <ContextMenuItem
          className={contextMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            void handleDownload(item);
          }}
        >
          <span className={contextMenuIconClassName}>
            <Download className="h-3.5 w-3.5" />
          </span>
          <span>Download</span>
        </ContextMenuItem>
      )}

      {item.type === "directory" && (
        <ContextMenuItem
          className={contextMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            openCreateFolderModal(item.id);
          }}
        >
          <span className={contextMenuIconClassName}>
            <FolderPlus className="h-3.5 w-3.5" />
          </span>
          <span>New Folder</span>
        </ContextMenuItem>
      )}

      {item.type === "directory" && (
        <ContextMenuItem
          className={contextMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            startUploadForFolder(item.id);
          }}
        >
          <span className={contextMenuIconClassName}>
            <Upload className="h-3.5 w-3.5" />
          </span>
          <span>Upload File</span>
        </ContextMenuItem>
      )}

      <ContextMenuItem
        className={contextMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          handleRename(item);
        }}
      >
        <span className={contextMenuIconClassName}>
          <Pencil className="h-3.5 w-3.5" />
        </span>
        <span>Rename</span>
      </ContextMenuItem>

      <ContextMenuItem
        className={contextMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          void handleShare(item);
        }}
      >
        <span className={contextMenuIconClassName}>
          <Share2 className="h-3.5 w-3.5" />
        </span>
        <span>Share</span>
      </ContextMenuItem>

      <ContextMenuItem
        className={contextMenuDangerItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          setItemToDelete(item);
        }}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </span>
        <span>Delete</span>
      </ContextMenuItem>
    </>
  );

  const renderDropdownActionMenuItems = (
    item: DirectoryItem,
    meta: FileMetadata | undefined,
  ) => (
    <>
      <DropdownMenuItem
        className={actionMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          setItemInfo({ item, metadata: meta || {} });
        }}
      >
        <Info className="h-3 w-3 text-zinc-500" />
        <span>Info</span>
      </DropdownMenuItem>

      {item.type === "file" && (
        <DropdownMenuItem
          className={actionMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            void handleDownload(item);
          }}
        >
          <Download className="h-3 w-3 text-zinc-500" />
          <span>Download</span>
        </DropdownMenuItem>
      )}

      {item.type === "directory" && (
        <DropdownMenuItem
          className={actionMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            openCreateFolderModal(item.id);
          }}
        >
          <FolderPlus className="h-3 w-3 text-zinc-500" />
          <span>New Folder</span>
        </DropdownMenuItem>
      )}

      {item.type === "directory" && (
        <DropdownMenuItem
          className={actionMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            startUploadForFolder(item.id);
          }}
        >
          <Upload className="h-3 w-3 text-zinc-500" />
          <span>Upload File</span>
        </DropdownMenuItem>
      )}

      <DropdownMenuItem
        className={actionMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          handleRename(item);
        }}
      >
        <Pencil className="h-3 w-3 text-zinc-500" />
        <span>Rename</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        className={actionMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          void handleShare(item);
        }}
      >
        <Share2 className="h-3 w-3 text-zinc-500" />
        <span>Share</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        className="rounded-md h-8 gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-[10px] font-bold uppercase tracking-wider"
        onClick={(e) => {
          e.stopPropagation();
          setItemToDelete(item);
        }}
      >
        <Trash2 className="h-3 w-3" />
        <span>Delete</span>
      </DropdownMenuItem>
    </>
  );

  const renderCurrentFolderContextMenuItems = () => (
    <>
      <div className="px-2.5 pb-2 pt-1.5">
        <p className="truncate text-[11px] font-black uppercase tracking-widest text-zinc-500">
          {currentFolder?.name || "My Drive"}
        </p>
      </div>
      <ContextMenuItem
        className={contextMenuItemClassName}
        onClick={(e) => {
          e.stopPropagation();
          openCreateFolderModal(currentFolderId ?? null);
        }}
      >
        <span className={contextMenuIconClassName}>
          <FolderPlus className="h-3.5 w-3.5" />
        </span>
        <span>New Folder</span>
      </ContextMenuItem>

      {canUpload && (
        <ContextMenuItem
          className={contextMenuItemClassName}
          onClick={(e) => {
            e.stopPropagation();
            startUploadForFolder(currentFolderId ?? null);
          }}
        >
          <span className={contextMenuIconClassName}>
            <Upload className="h-3.5 w-3.5" />
          </span>
          <span>Upload File</span>
        </ContextMenuItem>
      )}

      {currentDirectoryItem && (
        <>
          <div className="my-1 border-t border-white/10" />
          <ContextMenuItem
            className={contextMenuItemClassName}
            onClick={(e) => {
              e.stopPropagation();
              setItemInfo({ item: currentDirectoryItem, metadata: {} });
            }}
          >
            <span className={contextMenuIconClassName}>
              <Info className="h-3.5 w-3.5" />
            </span>
            <span>Info</span>
          </ContextMenuItem>

          <ContextMenuItem
            className={contextMenuItemClassName}
            onClick={(e) => {
              e.stopPropagation();
              handleRename(currentDirectoryItem);
            }}
          >
            <span className={contextMenuIconClassName}>
              <Pencil className="h-3.5 w-3.5" />
            </span>
            <span>Rename</span>
          </ContextMenuItem>

          <ContextMenuItem
            className={contextMenuItemClassName}
            onClick={(e) => {
              e.stopPropagation();
              void handleShare(currentDirectoryItem);
            }}
          >
            <span className={contextMenuIconClassName}>
              <Share2 className="h-3.5 w-3.5" />
            </span>
            <span>Share</span>
          </ContextMenuItem>

          <ContextMenuItem
            className={contextMenuDangerItemClassName}
            onClick={(e) => {
              e.stopPropagation();
              setItemToDelete(currentDirectoryItem);
            }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </span>
            <span>Delete</span>
          </ContextMenuItem>
        </>
      )}
    </>
  );

  return (
    <div
      className="mx-auto w-full max-w-[1440px] space-y-5 px-1 relative min-h-[calc(100vh-8rem)] animate-in fade-in duration-700"
      onDragEnter={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
          return;
        setDragActive(false);
      }}
      onDrop={handleDropUpload}
    >
      {dragActive && canUpload && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md border-2 border-dashed border-primary/50 rounded-3xl pointer-events-none">
          <div className="rounded-3xl border border-white/10 bg-[#0a0810]/90 px-8 py-6 text-center shadow-2xl">
            <Upload className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-bold text-white">
              Drop images or files to upload
            </p>
          </div>
        </div>
      )}
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center flex-wrap gap-1.5 overflow-hidden">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-zinc-700 shrink-0" />
              )}
              <button
                onClick={() => navigateTo(index)}
                disabled={index === breadcrumbs.length - 1}
                className={cn(
                  "text-sm font-bold transition-all truncate max-w-[150px] outline-none",
                  index === breadcrumbs.length - 1
                    ? "text-white cursor-default"
                    : "text-zinc-500 hover:text-primary cursor-pointer",
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
              view === "grid"
                ? "bg-primary text-white shadow-lg"
                : "text-zinc-500 hover:text-white",
            )}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-3 w-3 mr-1.5" />
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              view === "list"
                ? "bg-primary text-white shadow-lg"
                : "text-zinc-500 hover:text-white",
            )}
            onClick={() => setView("list")}
          >
            <ListIcon className="h-3 w-3 mr-1.5" />
            List
          </Button>
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="group relative flex h-12 w-full items-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus-within:border-primary/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(170,59,255,0.08)]">
          <Search className="absolute left-4 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search folders and files..."
            className="h-full flex-1 border-0 bg-transparent pl-11 pr-14 text-sm text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 sm:pr-32"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 flex items-center gap-2">
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
              {filteredItems.length}{" "}
              {filteredItems.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
      </div>

      {/* Items Display */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-[420px]">
            {loading ? (
              <div
                className={cn(
                  "grid gap-3",
                  view === "grid"
                    ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
                    : "grid-cols-1",
                )}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton
                    key={i}
                    className={cn(
                      "bg-white/5 rounded-xl",
                      view === "grid" ? "h-32" : "h-14",
                    )}
                  />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <Folder className="h-12 w-12 text-zinc-600 mb-4 stroke-1" />
                <p className="text-sm font-medium text-zinc-500">
                  This collection is empty
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-3",
                  view === "grid"
                    ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
                    : "grid-cols-1",
                )}
              >
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
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <Card
                              onClick={() => handleFolderClick(item)}
                              onContextMenu={(e) => e.stopPropagation()}
                              className={cn(
                                "group relative border-white/5 bg-white/5 transition-all duration-300 hover:bg-white/10 cursor-pointer overflow-hidden rounded-xl shadow-sm hover:shadow-primary/5 hover:border-primary/20 flex",
                                view === "grid"
                                  ? "h-32 p-3 flex-col items-center justify-center text-center gap-3"
                                  : "p-2 px-3 items-center justify-between h-14",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-3 min-w-0",
                                  view === "grid"
                                    ? "flex-col w-full"
                                    : "flex-row",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                    view === "grid" ? "h-10 w-10" : "h-9 w-9",
                                    item.type === "directory"
                                      ? "bg-primary/10 text-primary group-hover:bg-primary/20"
                                      : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-white",
                                  )}
                                >
                                  {item.type === "directory" ? (
                                    <Folder
                                      className="h-5 w-5"
                                      strokeWidth={1.5}
                                    />
                                  ) : (
                                    <FileIcon
                                      className="h-5 w-5"
                                      strokeWidth={1.5}
                                    />
                                  )}
                                </div>
                                <div className="overflow-hidden">
                                  <p
                                    className={cn(
                                      "truncate text-[11px] font-bold text-white group-hover:text-primary transition-colors",
                                      view === "grid"
                                        ? "text-center"
                                        : "text-left",
                                    )}
                                  >
                                    {item.name}
                                  </p>
                                  <div
                                    className={cn(
                                      "flex items-center gap-2 mt-0.5 opacity-60",
                                      view === "grid"
                                        ? "justify-center"
                                        : "justify-start",
                                    )}
                                  >
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

                              <div
                                className={cn(
                                  view === "grid"
                                    ? "absolute top-1 right-1"
                                    : "relative ml-2",
                                )}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-6 w-6 rounded-md text-zinc-600 transition-all hover:bg-white/5 hover:text-white",
                                        view === "grid"
                                          ? "opacity-70 group-hover:opacity-100"
                                          : "opacity-100",
                                      )}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className={actionMenuClassName}
                                  >
                                    {renderDropdownActionMenuItems(item, meta)}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </Card>
                          </ContextMenuTrigger>
                          <ContextMenuContent className={contextMenuClassName}>
                            {renderActionMenuItems(item, meta)}
                          </ContextMenuContent>
                        </ContextMenu>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className={contextMenuClassName}>
          {renderCurrentFolderContextMenuItems()}
        </ContextMenuContent>
      </ContextMenu>

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
                    disabled={uploadingFiles}
                    className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 text-primary hover:bg-white/10 hover:border-primary/50 shadow-2xl transition-all hover:scale-110 active:scale-95"
                    onClick={() => startUploadForFolder(currentFolderId)}
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
                  onClick={() => openCreateFolderModal(currentFolderId)}
                >
                  <FolderPlus className="h-6 w-6" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          disabled={uploadingFiles}
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
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={onFileUpload}
        />
      </div>

      {/* Modals & Dialogs */}
      <Dialog
        open={isFolderModalOpen}
        onOpenChange={(open) => {
          setIsFolderModalOpen(open);
          if (!open) {
            setCreateFolderParentId(null);
            setCreateFolderParentName(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in{" "}
              <strong>
                {createFolderParentName || currentFolder?.name || "My Drive"}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onFolderCreate)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Folder name"
                          {...field}
                          disabled={createLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsFolderModalOpen(false);
                      setCreateFolderParentId(null);
                      setCreateFolderParentName(null);
                    }}
                    disabled={createLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              Update the display name for <strong>{renameTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="New name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={renameLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void submitRename();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={renameLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitRename()}
              disabled={renameLoading || !renameValue.trim()}
            >
              {renameLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent className="bg-[#0a0810]/95 backdrop-blur-3xl border-white/10 text-white rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">
              Delete Item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-400">
              Are you sure you want to delete{" "}
              <span className="text-white font-bold">
                "{itemToDelete?.name}"
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
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
