import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";
import { authApi } from "./api";
import { forgotPasswordFormSchema, type ForgotPasswordFormData } from "./schemas";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";

export const ForgotPasswordPage: React.FC = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const res = await authApi.forgotPassword(data.email);
      setSuccessMessage(
        res.message ||
          "If an account with that email exists, a password reset link has been sent."
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.error) {
        const apiErr = err.response.data.error;
        setServerError(typeof apiErr === "string" ? apiErr : apiErr.message || "Request failed.");
      } else {
        setServerError("Failed to process password reset request. Please try again.");
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
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              Enter your work email and we&apos;ll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage ? (
              <div className="space-y-4">
                <Alert variant="success">{successMessage}</Alert>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Please check your inbox and spam folder. The link will expire in 30 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {serverError && <Alert variant="destructive">{serverError}</Alert>}

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

                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Remembered your password?{" "}
              <Link
                to="/login"
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Back to Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
