import React from "react";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  FileText,
  Clock,
  HelpCircle,
} from "lucide-react";

interface EmptyChatStateProps {
  onSelectSuggestion: (question: string) => void;
}

const EXAMPLE_QUESTIONS = [
  {
    icon: Clock,
    title: "Remote Work & Hours",
    question: "What is the company remote work policy and how many days can I work from home?",
    category: "HR Policy",
  },
  {
    icon: FileText,
    title: "Expense Reimbursement",
    question: "What is the policy and spending limit for travel, lodging, and meal reimbursements?",
    category: "Finance",
  },
  {
    icon: ShieldCheck,
    title: "IT Equipment & Access",
    question: "How do I request standard software licenses and new developer equipment?",
    category: "IT Support",
  },
  {
    icon: HelpCircle,
    title: "Paid Time Off & Leave",
    question: "What are the annual leave entitlements, sick leave policies, and rollover rules?",
    category: "Benefits",
  },
];

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  onSelectSuggestion,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-auto animate-in fade-in duration-300">
      {/* Icon Badge */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Bot className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        NexusOps Document Assistant
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md leading-relaxed">
        Ask questions across company manuals, policies, and guidelines.
        Every answer is grounded in factual document sources with verified page citations.
      </p>

      {/* Example Question Cards */}
      <div className="w-full text-left space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Suggested Questions
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {EXAMPLE_QUESTIONS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSuggestion(item.question)}
                className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                  {item.question}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
