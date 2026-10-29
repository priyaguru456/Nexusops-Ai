import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/ui/toast";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ModulePlaceholder } from "./pages/ModulePlaceholder";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RequestsListPage } from "./features/requests/RequestsListPage";
import { CreateRequestPage } from "./features/requests/CreateRequestPage";
import { EditRequestPage } from "./features/requests/EditRequestPage";
import { RequestDetailPage } from "./features/requests/RequestDetailPage";
import { TasksPage } from "./features/tasks/TasksPage";

export default function App(): React.JSX.Element {
  return (
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
            <Route
              path="/documents"
              element={
                <ModulePlaceholder
                  title="Knowledge Base"
                  description="Upload company documents for AI vector search"
                />
              }
            />
            <Route
              path="/ai"
              element={
                <ModulePlaceholder
                  title="AI Document Assistant"
                  description="Interactive chat and RAG document intelligence"
                />
              }
            />

            {/* Manager and Admin routes */}
            <Route
              path="/approvals"
              element={
                <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                  <ModulePlaceholder
                    title="Approvals"
                    description="Review and decide on pending workflow requests"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                  <ModulePlaceholder
                    title="Analytics"
                    description="Performance indicators, request metrics, and system charts"
                  />
                </ProtectedRoute>
              }
            />

            {/* Admin only routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ModulePlaceholder
                    title="User Management"
                    description="Manage company employees, assign roles, and toggle status"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ModulePlaceholder
                    title="Audit Logs"
                    description="Security, authentication, and administrative audit trails"
                  />
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
);
}
