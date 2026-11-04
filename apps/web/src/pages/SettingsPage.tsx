import React, { useState } from "react";
import { User as UserIcon, Lock, Shield, Mail, Building, AlertCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { profileApi } from "../features/auth/api";
import { updateProfileSchema, changePasswordFormSchema } from "../features/auth/schemas";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { BackButton } from "../components/ui/BackButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { useToast } from "../components/ui/toast";

export function SettingsPage(): React.JSX.Element {
  const { user, updateUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const validation = updateProfileSchema.safeParse({ name });
    if (!validation.success) {
      setProfileError(validation.error.issues[0]?.message || "Invalid name");
      return;
    }

    try {
      setProfileSaving(true);
      const res = await profileApi.updateProfile({ name: name.trim() });
      updateUser(res.user);
      toastSuccess("Your display name has been successfully updated.", "Profile updated");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to update profile.";
      setProfileError(message);
      toastError(message, "Update failed");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});

    const validation = changePasswordFormSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = String(issue.path[0] || "general");
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setPasswordErrors(fieldErrors);
      return;
    }

    try {
      setPasswordSaving(true);
      await profileApi.changePassword({
        currentPassword,
        newPassword,
      });

      toastSuccess("All other sessions have been logged out for security.", "Password changed successfully");

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to change password.";
      setPasswordErrors({ general: message });
      toastError(message, "Password change failed");
    } finally {
      setPasswordSaving(false);
    }
  };

  const roleBadgeVariant = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your personal details, credentials, and account security.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Profile Details</CardTitle>
            </div>
            <CardDescription>
              Update your display name. Organizational attributes like email and role are governed by system administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-lg">
              {profileError && (
                <div
                  id="profile-error-banner"
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Name field */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  aria-describedby={profileError ? "profile-error-banner" : undefined}
                />
              </div>

              {/* Email (Read only) */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email Address</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="profile-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="pl-9 bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed opacity-80"
                    aria-describedby="email-help"
                  />
                </div>
                <p id="email-help" className="text-[11px] text-slate-400">
                  Contact an administrator to change your corporate email.
                </p>
              </div>

              {/* Organization Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Assigned Role
                  </span>
                  <div>
                    <Badge variant={roleBadgeVariant(user?.role)} className="text-xs">
                      {user?.role || "EMPLOYEE"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Department
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {user?.department?.name || "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="pt-3">
                <Button type="submit" isLoading={profileSaving} disabled={profileSaving || name === user?.name}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security / Password Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Security & Password</CardTitle>
            </div>
            <CardDescription>
              Ensure your account uses a strong password of at least 8 characters. Changing your password revokes all active refresh tokens on other devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
              {passwordErrors.general && (
                <div
                  id="password-general-error"
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordErrors.general}</span>
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  aria-describedby={passwordErrors.currentPassword ? "current-password-error" : undefined}
                />
                {passwordErrors.currentPassword && (
                  <p id="current-password-error" className="text-xs text-rose-600">
                    {passwordErrors.currentPassword}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  aria-describedby={passwordErrors.newPassword ? "new-password-error" : undefined}
                />
                {passwordErrors.newPassword && (
                  <p id="new-password-error" className="text-xs text-rose-600">
                    {passwordErrors.newPassword}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  aria-describedby={passwordErrors.confirmPassword ? "confirm-password-error" : undefined}
                />
                {passwordErrors.confirmPassword && (
                  <p id="confirm-password-error" className="text-xs text-rose-600">
                    {passwordErrors.confirmPassword}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" isLoading={passwordSaving} disabled={passwordSaving}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
