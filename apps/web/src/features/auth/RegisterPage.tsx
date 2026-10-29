import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useAuth } from "./AuthContext";
import { registerSchema, type RegisterFormData } from "./schemas";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";

export const RegisterPage: React.FC = () => {
  const { register: registerAuth, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await registerAuth(data.name, data.email, data.password);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.error) {
        setServerError(err.response.data.error);
      } else {
        setServerError("Failed to register. Please check your information.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-lg shadow-indigo-500/20 mb-3">
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            NexusOps AI
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create an enterprise employee account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Enter your details below to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {serverError && (
                <Alert variant="destructive">
                  {serverError}
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Alex Morgan"
                  autoComplete="name"
                  error={!!errors.name}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
                )}
              </div>

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
                <Label htmlFor="password">Password (min. 8 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={!!errors.password}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Create Account
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
