import React, { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Users,
  FolderTree,
  Loader2,
  HelpCircle,
  Filter,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { fetchDirectReports, fetchOrgRoots } from "./api";
import { getInitials, getAvatarColor } from "./ProfileCard";
import type { DirectoryUser, DepartmentSummary, OrgNode } from "../../types/directory";
import type { Role } from "../../types/auth";

interface OrgChartViewProps {
  departments: DepartmentSummary[];
  selectedDepartmentId: string;
  onDepartmentChange: (deptId: string) => void;
  onSelectUser: (user: DirectoryUser) => void;
}

export function OrgChartView({
  departments,
  selectedDepartmentId,
  onDepartmentChange,
  onSelectUser,
}: OrgChartViewProps): React.JSX.Element {
  const [treeData, setTreeData] = useState<OrgNode[]>([]);
  const [isLoadingRoots, setIsLoadingRoots] = useState(true);
  const [errorRoots, setErrorRoots] = useState<string | null>(null);

  // Fetch roots on department change
  useEffect(() => {
    let isMounted = true;
    async function loadRoots() {
      setIsLoadingRoots(true);
      setErrorRoots(null);
      try {
        const roots = await fetchOrgRoots(
          selectedDepartmentId === "ALL" ? undefined : selectedDepartmentId
        );
        if (isMounted) {
          setTreeData(
            roots.map((r) => ({
              ...r,
              children: [],
              isExpanded: false,
              isLoadingChildren: false,
              hasLoadedChildren: false,
            }))
          );
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorRoots("Failed to load organization hierarchy.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingRoots(false);
        }
      }
    }
    loadRoots();
    return () => {
      isMounted = false;
    };
  }, [selectedDepartmentId]);

  // Recursively update a node in the tree state
  const updateNodeInTree = (
    nodes: OrgNode[],
    targetId: string,
    updater: (node: OrgNode) => OrgNode
  ): OrgNode[] => {
    return nodes.map((node) => {
      if (node.id === targetId) {
        return updater(node);
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, targetId, updater),
        };
      }
      return node;
    });
  };

  // Lazy-load direct reports on node expansion
  const toggleNodeExpansion = async (node: OrgNode) => {
    if (node.isExpanded) {
      // Simply collapse
      setTreeData((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({ ...n, isExpanded: false }))
      );
      return;
    }

    // Expanding
    if (node.hasLoadedChildren || node.directReportsCount === 0) {
      setTreeData((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({ ...n, isExpanded: true }))
      );
      return;
    }

    // Need to lazy-load direct reports from API
    setTreeData((prev) =>
      updateNodeInTree(prev, node.id, (n) => ({
        ...n,
        isLoadingChildren: true,
      }))
    );

    try {
      const reports = await fetchDirectReports(node.id);
      const childNodes: OrgNode[] = reports.map((r) => ({
        ...r,
        children: [],
        isExpanded: false,
        isLoadingChildren: false,
        hasLoadedChildren: false,
      }));

      setTreeData((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({
          ...n,
          children: childNodes,
          isExpanded: true,
          isLoadingChildren: false,
          hasLoadedChildren: true,
        }))
      );
    } catch {
      setTreeData((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({
          ...n,
          isLoadingChildren: false,
        }))
      );
    }
  };

  const roleVariant = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  // Collapse all loaded nodes
  const collapseAll = () => {
    const collapseRecursive = (nodes: OrgNode[]): OrgNode[] =>
      nodes.map((n) => ({
        ...n,
        isExpanded: false,
        children: n.children ? collapseRecursive(n.children) : [],
      }));
    setTreeData((prev) => collapseRecursive(prev));
  };

  // Render a single tree branch recursively
  const renderTreeNode = (node: OrgNode, depth = 0): React.JSX.Element => {
    const hasReports = node.directReportsCount > 0;

    return (
      <div key={node.id} className="relative flex flex-col">
        {/* Node Item Box */}
        <div
          className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-150 ${
            depth === 0
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700"
              : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800/70 hover:bg-white dark:hover:bg-slate-800"
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Expand / Collapse Button */}
            {hasReports ? (
              <button
                type="button"
                onClick={() => toggleNodeExpansion(node)}
                disabled={node.isLoadingChildren}
                aria-label={
                  node.isExpanded
                    ? `Collapse reports for ${node.name}`
                    : `Expand ${node.directReportsCount} reports for ${node.name}`
                }
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {node.isLoadingChildren ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : node.isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}

            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${getAvatarColor(
                node.name
              )}`}
              aria-hidden="true"
            >
              {getInitials(node.name)}
            </div>

            {/* Info */}
            <div
              className="min-w-0 cursor-pointer"
              onClick={() => onSelectUser(node)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectUser(node);
                }
              }}
              title="Click to view team details"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                  {node.name}
                </span>
                <Badge variant={roleVariant(node.role)} className="text-[10px] px-1.5 py-0 uppercase">
                  {node.role}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span>{node.email}</span>
                {node.department && (
                  <span className="hidden sm:inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                    • {node.department.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action / Reports badge */}
          <div className="flex items-center gap-2 shrink-0">
            {hasReports && (
              <Badge
                variant="secondary"
                className="text-[11px] font-semibold gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60"
              >
                <Users className="w-3 h-3" />
                <span>
                  {node.directReportsCount} {node.directReportsCount === 1 ? "report" : "reports"}
                </span>
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectUser(node)}
              className="hidden sm:inline-flex text-xs h-7 px-2.5 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40"
              aria-label={`View team of ${node.name}`}
            >
              Team
            </Button>
          </div>
        </div>

        {/* Children Render (Lazy-loaded branch) */}
        {node.isExpanded && node.children && node.children.length > 0 && (
          <div className="relative mt-2 space-y-2 border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-2">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Split into Leaders with reports and Individual Contributors without manager
  const leadersWithReports = treeData.filter((u) => u.directReportsCount > 0);
  const individualRoots = treeData.filter((u) => u.directReportsCount === 0);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Scope Department:</span>
          </div>
          <select
            aria-label="Filter org tree by department"
            value={selectedDepartmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Entire Organization (All Departments)</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.userCount})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="text-xs h-8"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoadingRoots && (
        <div className="space-y-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {errorRoots && !isLoadingRoots && (
        <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-center">
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">{errorRoots}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDepartmentChange(selectedDepartmentId)}
            className="mt-3 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingRoots && !errorRoots && treeData.length === 0 && (
        <div className="p-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
          <FolderTree className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
            No organizational nodes found
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No members or managers matched the selected department filter.
          </p>
        </div>
      )}

      {/* Loaded Org Hierarchy */}
      {!isLoadingRoots && !errorRoots && treeData.length > 0 && (
        <div className="space-y-8">
          {/* Section 1: Department Heads & Managers */}
          {leadersWithReports.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                  Department Heads & Leadership Trees
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({leadersWithReports.length} {leadersWithReports.length === 1 ? "branch" : "branches"})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any chevron arrow to expand and lazy-load direct reporting teams.
              </p>

              <div className="space-y-3 pt-2">
                {leadersWithReports.map((root) => renderTreeNode(root, 0))}
              </div>
            </div>
          )}

          {/* Section 2: Members without a manager / Standalone Contributors */}
          {individualRoots.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                  Individual Members Without a Reporting Manager
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({individualRoots.length} {individualRoots.length === 1 ? "member" : "members"})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These individuals currently have no reporting manager assigned in their profile.
              </p>

              <div className="space-y-2.5 pt-2">
                {individualRoots.map((member) => renderTreeNode(member, 0))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
