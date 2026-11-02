import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Inbox } from "lucide-react";
import type { TimeSeriesPoint, CategoryStat } from "../types";

// Accessible color palettes designed for dark and light modes
const CHART_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#3b82f6", // blue
];

interface EmptyChartStateProps {
  message?: string;
  height?: number;
}

export const EmptyChartState: React.FC<EmptyChartStateProps> = ({
  message = "No data recorded for the selected date range.",
  height = 240,
}) => (
  <div
    style={{ height }}
    className="w-full flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
  >
    <Inbox className="w-8 h-8 text-slate-400 mb-2" />
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);

// Custom Chart Tooltip styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md text-xs">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 dark:text-slate-400">{entry.name || "Value"}:</span>
            <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// 1. Requests / Questions Over Time Area Chart
interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  color?: string;
  name?: string;
  height?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  color = "#6366f1",
  name = "Activity",
  height = 260,
}) => {
  if (!data || data.length === 0 || data.every((d) => d.count === 0)) {
    return <EmptyChartState message="No recorded activity over this time range." height={height} />;
  }

  // Sample or format dates nicely
  const formattedData = data.map((d) => ({
    date: d.date.length > 5 ? d.date.slice(5) : d.date, // MM-DD
    count: d.count,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            name={name}
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#gradient-${color})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// 2. Category Pie / Donut Chart
interface CategoryPieChartProps {
  data: CategoryStat[];
  height?: number;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, height = 260 }) => {
  if (!data || data.length === 0 || data.every((d) => d.count === 0)) {
    return <EmptyChartState message="No category breakdown available." height={height} />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            formatter={(value) => <span className="text-xs text-slate-700 dark:text-slate-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// 3. Simple Bar Chart (Priorities, Statuses)
interface SimpleBarChartProps {
  data: Array<{ label: string; count: number }>;
  color?: string;
  name?: string;
  height?: number;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  color = "#10b981",
  name = "Count",
  height = 240,
}) => {
  if (!data || data.length === 0 || data.every((d) => d.count === 0)) {
    return <EmptyChartState message="No data available for this chart." height={height} />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name={name} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 4. Horizontal Top Documents Bar Chart
interface TopDocumentsChartProps {
  data: Array<{ title: string; citationCount: number }>;
  height?: number;
}

export const TopDocumentsChart: React.FC<TopDocumentsChartProps> = ({ data, height = 260 }) => {
  if (!data || data.length === 0) {
    return <EmptyChartState message="No document citations recorded in this range." height={height} />;
  }

  const truncated = data.map((d) => ({
    title: d.title.length > 20 ? `${d.title.slice(0, 18)}...` : d.title,
    fullTitle: d.title,
    count: d.citationCount,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={truncated}
          margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <YAxis type="category" dataKey="title" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Citations" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
