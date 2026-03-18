"use client";

import React from "react";

type RiskLevel = "critical" | "high" | "medium" | "low";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const riskConfig: Record<RiskLevel, { label: string; classes: string }> = {
  critical: {
    label: "Critical",
    classes: "bg-red-100 text-red-800 border border-red-300",
  },
  high: {
    label: "High",
    classes: "bg-orange-100 text-orange-800 border border-orange-300",
  },
  medium: {
    label: "Medium",
    classes: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  },
  low: {
    label: "Low",
    classes: "bg-green-100 text-green-800 border border-green-300",
  },
};

export default function RiskBadge({ level, className = "" }: RiskBadgeProps) {
  const config = riskConfig[level];

  if (!config) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.classes} ${className}`}
    >
      {config.label}
    </span>
  );
}
