import React, { useEffect, useState } from "react";
import { Laptop, AlertCircle, Calendar, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatKolkataDate } from "../../lib/utils";
import { AssetTypeIcon } from "./AssetTypeIcon";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { WarrantyBadge } from "./WarrantyBadge";
import { assetsApi } from "./api";
import type { Asset } from "./types";

export const MyAssignedAssetsTab: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMyAssets = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await assetsApi.getMyAssets();
      setAssets(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to load your assigned assets.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyAssets();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-28 w-full" />
        <LoadingSkeleton className="h-28 w-full" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div
        role="alert"
        className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadMyAssets}>
          Retry
        </Button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        title="No Assets Assigned"
        description="You do not currently have any IT hardware, displays, or software licenses assigned to your account."
        icon={Laptop}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assets.map((asset) => {
          const activeAssignment = asset.assignments?.find((a) => a.returnedAt === null);

          return (
            <Card key={asset.id} className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      <AssetTypeIcon type={asset.type} size="md" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{asset.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {asset.type} • Serial: {asset.serialNumber || "None"}
                      </CardDescription>
                    </div>
                  </div>
                  <AssetStatusBadge status={asset.status} size="sm" />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Assigned Date
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {activeAssignment ? formatKolkataDate(activeAssignment.assignedAt) : "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-slate-400" /> Warranty
                    </span>
                    <WarrantyBadge warrantyExpiresAt={asset.warrantyExpiresAt} />
                  </div>
                </div>

                {activeAssignment?.notes && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                    &ldquo;{activeAssignment.notes}&rdquo;
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
