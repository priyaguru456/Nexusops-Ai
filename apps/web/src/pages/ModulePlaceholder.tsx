import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({ title, description }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm font-medium">{title} module is ready for next development tasks.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
