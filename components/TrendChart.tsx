"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendDataPoint {
  date: string;
  averageScore: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm text-indigo-600">
          Score:{" "}
          <span className="font-semibold">{payload[0].value.toFixed(1)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm">No trend data available</p>
      </div>
    );
  }

  const formattedData = data.map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const scores = data.map((d) => d.averageScore);
  const minScore = Math.max(0, Math.floor(Math.min(...scores) - 5));
  const maxScore = Math.min(100, Math.ceil(Math.max(...scores) + 5));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minScore, maxScore]}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="averageScore"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ fill: "#6366f1", strokeWidth: 0, r: 3 }}
            activeDot={{ fill: "#4f46e5", strokeWidth: 0, r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
