import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/toast";
import { calendarApi } from "./calendarApi";
import type { CalendarEvent } from "../../types/calendar";
import { getKolkataDateKey } from "./calendarUtils";

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  holidayToEdit?: CalendarEvent | null;
}

export const HolidayModal: React.FC<HolidayModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  holidayToEdit,
}) => {
  const { success } = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(holidayToEdit);

  useEffect(() => {
    if (holidayToEdit) {
      setName(holidayToEdit.title);
      setDate(getKolkataDateKey(holidayToEdit.start));
    } else {
      setName("");
      // Default to today in Asia/Kolkata
      setDate(getKolkataDateKey(new Date()));
    }
    setError(null);
  }, [holidayToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError("Holiday name must be at least 2 characters");
      return;
    }

    if (!date) {
      setError("Please select a date for the holiday");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing && holidayToEdit) {
        await calendarApi.updateHoliday(holidayToEdit.rawId, {
          name: name.trim(),
          date,
        });
        success(`Company holiday "${name.trim()}" updated successfully.`, "Holiday Updated");
      } else {
        await calendarApi.addHoliday({
          name: name.trim(),
          date,
        });
        success(`Company holiday "${name.trim()}" registered successfully.`, "Holiday Added");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Failed to save holiday";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="holiday-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3
              id="holiday-modal-title"
              className="text-base font-bold text-neutral-900 dark:text-neutral-100"
            >
              {isEditing ? "Edit Company Holiday" : "Add Company Holiday"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="holiday-name" className="text-xs font-semibold">
              Holiday Name
            </Label>
            <Input
              id="holiday-name"
              type="text"
              placeholder="e.g. Diwali, Independence Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="holiday-date" className="text-xs font-semibold">
              Date (Asia/Kolkata)
            </Label>
            <Input
              id="holiday-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Company holidays are full-day observances applicable to all employees.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Holiday" : "Create Holiday"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
