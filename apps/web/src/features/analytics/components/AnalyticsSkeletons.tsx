import React from "react";
import { Card, CardContent } from "../../../components/ui/card";

export const AnalyticsSkeletons: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-7 w-14 bg-slate-300 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 p-4" />
        <div className="h-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 p-4" />
      </div>
    </div>
  );
};
