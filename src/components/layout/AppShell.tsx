import React from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { DriveBreadcrumbProvider } from "./DriveBreadcrumbProvider";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <DriveBreadcrumbProvider>
      <div className="flex min-h-screen bg-[#08060d]">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col lg:pl-72">
          <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-4 lg:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={window.location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </DriveBreadcrumbProvider>
  );
};
