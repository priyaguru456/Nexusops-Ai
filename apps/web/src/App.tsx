import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/ui/toast";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RequestsListPage } from "./features/requests/RequestsListPage";
import { CreateRequestPage } from "./features/requests/CreateRequestPage";
import { EditRequestPage } from "./features/requests/EditRequestPage";
import { RequestDetailPage } from "./features/requests/RequestDetailPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { ApprovalsInboxPage } from "./features/approvals/ApprovalsInboxPage";
import { AuditLogPage } from "./features/admin/AuditLogPage";
import { DocumentsPage } from "./features/documents/DocumentsPage";
import { AiAssistantPage } from "./features/ai/AiAssistantPage";
import { AnalyticsPage } from "./features/analytics/AnalyticsPage";
import { UserManagementPage } from "./features/admin/UserManagementPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public authentication routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            {/* Protected application routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                
                {/* Requests routes */}
                <Route path="/requests" element={<RequestsListPage />} />
                <Route path="/requests/new" element={<CreateRequestPage />} />
                <Route path="/requests/:id" element={<RequestDetailPage />} />
                <Route path="/requests/:id/edit" element={<EditRequestPage />} />

                {/* Tasks routes */}
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/ai" element={<AiAssistantPage />} />

                {/* Settings route */}
                <Route path="/settings" element={<SettingsPage />} />

                {/* Analytics route - scoped by role */}
                <Route path="/analytics" element={<AnalyticsPage />} />

                {/* Manager and Admin routes */}
                <Route
                  path="/approvals"
                  element={
                    <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                      <ApprovalsInboxPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin only routes */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute roles={["ADMIN"]}>
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={
                    <ProtectedRoute roles={["ADMIN"]}>
                      <AuditLogPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Route>

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
