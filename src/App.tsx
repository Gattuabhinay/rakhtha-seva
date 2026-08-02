import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { ScrollToTop } from "@/components/RequireAuth";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { RequestPage } from "@/pages/RequestPage";
import { DonorPage } from "@/pages/DonorPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DonorsWallPage } from "@/pages/DonorsWallPage";

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="request" element={<RequestPage />} />
          <Route path="donor" element={<DonorPage />} />
          <Route path="donors" element={<DonorsWallPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
