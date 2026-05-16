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

export const DriveBreadcrumbContext = React.createContext<DriveBreadcrumbContextValue | undefined>(undefined);

export const useDriveBreadcrumbs = () => {
  const context = React.useContext(DriveBreadcrumbContext);

  if (!context) {
    throw new Error("useDriveBreadcrumbs must be used within a DriveBreadcrumbProvider");
  }

  return context;
};
