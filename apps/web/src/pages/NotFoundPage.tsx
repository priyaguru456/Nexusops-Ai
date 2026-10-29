import React from "react";
import { Link } from "react-router-dom";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
          <Compass className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            404 - Page Not Found
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/dashboard">
            <Button variant="default" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
