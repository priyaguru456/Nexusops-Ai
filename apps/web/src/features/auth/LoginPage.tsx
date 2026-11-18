import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useAuth } from "./AuthContext";
import { loginSchema, type LoginFormData } from "./schemas";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const selectRole = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", "Password@123", { shouldValidate: true });
    setServerError(null);
  };

  if (!authLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data) {
        const resData = err.response.data as {
          error?: string;
          code?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        if (resData.details?.fieldErrors && Object.keys(resData.details.fieldErrors).length > 0) {
          const firstField = Object.keys(resData.details.fieldErrors)[0];
          const fieldMsg = resData.details.fieldErrors[firstField]?.[0];
          setServerError(fieldMsg ? `${resData.error || "Validation failed"}: ${fieldMsg}` : resData.error || "Validation failed");
        } else if (resData.code) {
          setServerError(`${resData.error || "Database error"} (${resData.code})`);
        } else if (resData.error) {
          setServerError(resData.error);
        } else {
          setServerError("Failed to sign in. Please verify your credentials.");
        }
      } else {
        setServerError("Failed to sign in. Please verify your credentials.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-950 overflow-hidden shadow-xl shadow-indigo-500/20 border border-slate-800/80 mb-3 hover:scale-105 transition-transform">
            <img src="/logo-icon.png" alt="NexusOps AI" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            NexusOps AI
          </h1>
          <p className="text-sm font-medium bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent mt-1">
            Connect • Automate • Grow
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your work email to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Quick Sign-in by Role:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectRole("admin@nexusops.com")}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors text-left flex items-center justify-between"
                >
                  <span>🛡️ Admin</span>
                  <span className="text-[10px] opacity-75 font-mono">Fill</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectRole("superadmin@nexusops.com")}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors text-left flex items-center justify-between"
                >
                  <span>👑 Super Admin</span>
                  <span className="text-[10px] opacity-75 font-mono">Fill</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectRole("manager.it@nexusops.com")}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors text-left flex items-center justify-between"
                >
                  <span>💼 IT Manager</span>
                  <span className="text-[10px] opacity-75 font-mono">Fill</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectRole("employee.it@nexusops.com")}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors text-left flex items-center justify-between"
                >
                  <span>👤 Employee</span>
                  <span className="text-[10px] opacity-75 font-mono">Fill</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {serverError && (
                <Alert variant="destructive">
                  {serverError}
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@nexusops.com"
                  autoComplete="email"
                  error={!!errors.email}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={!!errors.password}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Sign In
              </Button>

              <div className="rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Demo Credentials:</p>
                <p>Email: <code className="text-indigo-600 dark:text-indigo-400 font-mono select-all">admin@nexusops.com</code></p>
                <p>Password: <code className="text-indigo-600 dark:text-indigo-400 font-mono select-all">Password@123</code></p>
              </div>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
