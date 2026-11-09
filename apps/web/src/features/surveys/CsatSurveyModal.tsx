import React, { useState, useEffect, useRef } from "react";
import { Star, X, CheckCircle2, MessageSquare } from "lucide-react";
import { surveysApi } from "./api";
import { toast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { CategoryBadge } from "../../components/ui/CategoryBadge";
import type { PendingCsatData } from "../../types/surveys";
import type { RequestCategory } from "../../types/requests";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

interface CsatSurveyModalProps {
  // If passed directly, useful for isolated testing or forced trigger
  initialData?: PendingCsatData | null;
  onFinished?: () => void;
}

export const CsatSurveyModal: React.FC<CsatSurveyModalProps> = ({
  initialData,
  onFinished,
}) => {
  const [pendingData, setPendingData] = useState<PendingCsatData | null>(initialData ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch pending survey on mount if not provided via props
  useEffect(() => {
    if (initialData !== undefined) {
      if (initialData) {
        setPendingData(initialData);
        setIsOpen(true);
      }
      return;
    }

    let isMounted = true;
    const checkPending = async () => {
      try {
        const res = await surveysApi.getPendingCsat();
        if (isMounted && res.pending && res.data) {
          // Check local dismissal cache to avoid flickering on rapid page transitions
          const dismissedKey = `csat_dismissed_${res.data.request.id}`;
          if (!sessionStorage.getItem(dismissedKey)) {
            setPendingData(res.data);
            setIsOpen(true);
          }
        }
      } catch {
        // Silently ignore if not authorized or offline
      }
    };

    checkPending();
    return () => {
      isMounted = false;
    };
  }, [initialData]);

  const handleClose = () => {
    setIsOpen(false);
    if (pendingData) {
      sessionStorage.setItem(`csat_dismissed_${pendingData.request.id}`, "true");
    }
    if (onFinished) {
      onFinished();
    }
  };

  const handleSkip = async () => {
    if (!pendingData || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await surveysApi.submitResponse({
        surveyId: pendingData.survey.id,
        entityType: "REQUEST",
        entityId: pendingData.request.id,
        answers: {
          skipped: true,
          rating: null,
          comment: null,
        },
      });
    } catch (err) {
      // Even if network fails, we dismiss locally so user isn't stuck
      console.warn("Failed to record skip in backend:", err);
    } finally {
      setIsSubmitting(false);
      handleClose();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingData || !selectedRating || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await surveysApi.submitResponse({
        surveyId: pendingData.survey.id,
        entityType: "REQUEST",
        entityId: pendingData.request.id,
        answers: {
          rating: selectedRating,
          comment: comment.trim() || null,
          skipped: false,
        },
      });

      toast.success("Thank you! Your feedback helps us improve fulfillment quality.", "Feedback Received");
      handleClose();
    } catch {
      toast.error("Unable to record your satisfaction rating. Please try again.", "Submission Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation for rating radiogroup (Arrow keys, 1-5 number keys)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (["1", "2", "3", "4", "5"].includes(e.key)) {
      e.preventDefault();
      const num = parseInt(e.key, 10);
      setSelectedRating(num);
      starRefs.current[num - 1]?.focus();
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedRating((prev) => {
        const next = prev ? Math.min(5, prev + 1) : 1;
        starRefs.current[next - 1]?.focus();
        return next;
      });
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedRating((prev) => {
        const next = prev ? Math.max(1, prev - 1) : 1;
        starRefs.current[next - 1]?.focus();
        return next;
      });
    }
  };

  if (!isOpen || !pendingData) {
    return null;
  }

  const activeStar = hoverRating || selectedRating || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csat-modal-title"
      aria-describedby="csat-modal-description"
    >
      <div className="relative w-full max-w-lg bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Close / Skip button */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Close survey"
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Satisfaction Survey
          </div>
          <h2
            id="csat-modal-title"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            How satisfied are you with this fulfillment?
          </h2>
          <p id="csat-modal-description" className="text-sm text-muted-foreground mt-1">
            Your request has been marked as completed. We value your feedback to improve internal service delivery.
          </p>
        </div>

        {/* Completed Request Context Card */}
        <div className="mb-5 p-3 rounded-lg bg-muted/50 border border-border/80 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Fulfilled Request
            </span>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">
              {pendingData.request.title}
            </p>
          </div>
          <CategoryBadge category={pendingData.request.category as RequestCategory} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1-5 Star Interactive Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Overall Rating <span className="text-destructive">*</span>
            </label>

            <div
              role="radiogroup"
              tabIndex={0}
              aria-label="How satisfied are you with this fulfillment? Rating 1 to 5 stars"
              onKeyDown={handleKeyDown}
              className="flex items-center gap-2 focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= activeStar;
                const isSelected = star === selectedRating;

                return (
                  <button
                    key={star}
                    ref={(el) => {
                      starRefs.current[star - 1] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""} - ${RATING_LABELS[star]}`}
                    tabIndex={isSelected || (!selectedRating && star === 1) ? 0 : -1}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setSelectedRating(star)}
                    className="p-1.5 rounded-lg transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        isFilled
                          ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                          : "text-muted-foreground/40 hover:text-amber-400/60"
                      }`}
                    />
                  </button>
                );
              })}

              <span className="ml-3 text-sm font-medium min-w-[85px] text-foreground">
                {activeStar > 0 ? RATING_LABELS[activeStar] : "Select rating"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Use arrow keys or number keys 1–5 to select via keyboard.
            </p>
          </div>

          {/* Optional Feedback Comment */}
          <div className="space-y-1.5">
            <label
              htmlFor="csat-comment-input"
              className="text-sm font-medium text-foreground flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Additional Comments <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="csat-comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what went well or what could be improved..."
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <div className="text-right text-[11px] text-muted-foreground">
              {comment.length} / 1000
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={!selectedRating || isSubmitting}
                className="gap-2 font-medium"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
