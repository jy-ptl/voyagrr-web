import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "./store";
import { AppShell } from "./components/layout/AppShell";
import { HomeFeed } from "./components/feed/HomeFeed";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { MyDrivePage } from "./pages/drive/MyDrivePage";
import TripsPage from "./pages/trips/TripsPage";
import { TripDetailPage } from "./pages/trips/TripDetailPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import GroupsPage from "./pages/groups/GroupsPage";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected App Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/my-drive" replace />} />
                  <Route path="/feed" element={<HomeFeed />} />
                  <Route path="/my-drive" element={<MyDrivePage />} />
                  <Route path="/trips" element={<TripsPage />} />
                  <Route path="/trips/:tripId" element={<TripDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  {/* Add more internal routes here */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
