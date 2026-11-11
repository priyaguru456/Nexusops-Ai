import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import { authApi } from "./api";
import { resetPasswordFormSchema, type ResetPasswordFormData } from "./schemas";
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

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token")?.trim() || "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [successMessage, navigate]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setServerError("Password reset token is missing from the URL.");
      return;
    }

    setServerError(null);
    try {
      const res = await authApi.resetPassword({
        token,
        newPassword: data.newPassword,
      });
      setSuccessMessage(
        res.message || "Password has been reset successfully. Redirecting to sign in..."
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.error) {
        const apiErr = err.response.data.error;
        setServerError(
          typeof apiErr === "string" ? apiErr : apiErr.message || "Reset failed."
        );
      } else {
        setServerError("Invalid or expired password reset link. Please request a new one.");
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
            Set a new password for your account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Choose a strong password of at least 8 characters</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <Alert variant="destructive">
                Missing password reset token. Please request a new reset link.
              </Alert>
            ) : successMessage ? (
              <Alert variant="success">{successMessage}</Alert>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {serverError && <Alert variant="destructive">{serverError}</Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    error={!!errors.newPassword}
                    {...register("newPassword")}
                  />
                  {errors.newPassword && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                  Update Password
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <Link
                to="/forgot-password"
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Request a new link
              </Link>{" "}
              ·{" "}
              <Link
                to="/login"
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
