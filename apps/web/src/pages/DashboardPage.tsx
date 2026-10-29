import React from "react";
import { UserCheck, ShieldCheck, Mail, Building, FileText, CheckSquare, Bot } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-xs uppercase font-semibold tracking-wider text-indigo-200">
            Operations Workspace
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
            Welcome back, {user?.name || "Operator"}!
          </h1>
          <p className="text-indigo-100 text-sm mt-1">
            NexusOps AI document assistant and workflow platform.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20">
          <ShieldCheck className="h-5 w-5 text-indigo-200 shrink-0" />
          <div>
            <p className="text-xs text-indigo-200">Current Role</p>
            <p className="text-sm font-bold tracking-wide">{user?.role || "EMPLOYEE"}</p>
          </div>
        </div>
      </div>

      {/* User profile card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Operator Profile</CardTitle>
            <CardDescription>Your session details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <UserCheck className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-slate-100">{user?.name}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Building className="h-4 w-4 text-slate-400" />
              <span>{user?.department?.name || "Global Operations"}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Account Status</span>
              <Badge variant={user?.isActive ? "success" : "destructive"}>
                {user?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick modules placeholder */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Work Requests</CardTitle>
                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-slate-500 mt-1">Active requests submitted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Assigned Tasks</CardTitle>
                <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-slate-500 mt-1">Pending your action</p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">AI Document Assistant (RAG)</CardTitle>
                <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ask operational questions against uploaded company policies, SOPs, and manuals with citations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
