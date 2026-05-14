/* eslint-disable react-refresh/only-export-components */
import React from "react";

export interface DriveBreadcrumbItem {
  id: string | number | null;
  name: string;
}

interface DriveBreadcrumbContextValue {
  breadcrumbs: DriveBreadcrumbItem[];
  setBreadcrumbs: React.Dispatch<React.SetStateAction<DriveBreadcrumbItem[]>>;
  childDirectories: DriveBreadcrumbItem[];
  setChildDirectories: React.Dispatch<React.SetStateAction<DriveBreadcrumbItem[]>>;
  childDirectoriesFolderId: string | number | null;
  setChildDirectoriesFolderId: React.Dispatch<React.SetStateAction<string | number | null>>;
}

const DriveBreadcrumbContext = React.createContext<DriveBreadcrumbContextValue | undefined>(undefined);

export const DriveBreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveBreadcrumbItem[]>([
    { id: null, name: "My Drive" },
  ]);
  const [childDirectories, setChildDirectories] = React.useState<DriveBreadcrumbItem[]>([]);
  const [childDirectoriesFolderId, setChildDirectoriesFolderId] = React.useState<string | number | null>(null);

  const value = React.useMemo(
    () => ({
      breadcrumbs,
      setBreadcrumbs,
      childDirectories,
      setChildDirectories,
      childDirectoriesFolderId,
      setChildDirectoriesFolderId,
    }),
    [breadcrumbs, childDirectories, childDirectoriesFolderId],
  );

  return <DriveBreadcrumbContext.Provider value={value}>{children}</DriveBreadcrumbContext.Provider>;
};

export const useDriveBreadcrumbs = () => {
  const context = React.useContext(DriveBreadcrumbContext);

  if (!context) {
    throw new Error("useDriveBreadcrumbs must be used within a DriveBreadcrumbProvider");
  }

  return context;
};