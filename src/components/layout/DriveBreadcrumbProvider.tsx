import React from "react";
import {
  DriveBreadcrumbContext,
  type DriveBreadcrumbItem,
} from "./DriveBreadcrumbContext";

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
