"use client";

import React from "react";

interface RiskScoreGaugeProps {
  score: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
}

function getColorClass(score: number): string {
  if (score <= 20) return "bg-green-500";
  if (score <= 40) return "bg-lime-500";
  if (score <= 60) return "bg-yellow-500";
  if (score <= 80) return "bg-orange-500";
  return "bg-red-600";
}

function getTextColorClass(score: number): string {
  if (score <= 20) return "text-green-600";
  if (score <= 40) return "text-lime-600";
  if (score <= 60) return "text-yellow-600";
  if (score <= 80) return "text-orange-600";
  return "text-red-600";
}

function getRiskLabel(score: number): string {
  if (score <= 20) return "Very Low";
  if (score <= 40) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "High";
  return "Critical";
}

function getSizeClasses(size: "sm" | "md" | "lg") {
  switch (size) {
    case "sm":
      return { bar: "h-2", text: "text-sm", score: "text-lg" };
    case "lg":
      return { bar: "h-6", text: "text-lg", score: "text-4xl" };
    default:
      return { bar: "h-4", text: "text-base", score: "text-2xl" };
  }
}

export default function RiskScoreGauge({
  score,
  label,
  showValue = true,
  size = "md",
}: RiskScoreGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const colorClass = getColorClass(clampedScore);
  const textColorClass = getTextColorClass(clampedScore);
  const riskLabel = getRiskLabel(clampedScore);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className="w-full">
      {label && (
        <p className={`font-medium text-gray-700 mb-2 ${sizeClasses.text}`}>
          {label}
        </p>
      )}

      <div className="flex items-center gap-4 mb-2">
        {showValue && (
          <span
            className={`font-bold ${textColorClass} ${sizeClasses.score} min-w-[3rem] text-right`}
          >
            {clampedScore}
          </span>
        )}
        <div className="flex-1">
          <div
            className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses.bar}`}
            role="progressbar"
            aria-valuenow={clampedScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Risk score: ${clampedScore} out of 100`}
          >
            <div
              className={`${colorClass} ${sizeClasses.bar} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${colorClass}`}
          >
            {riskLabel}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 gap-4">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      <div className="relative mt-1">
        <div className="flex h-1.5 rounded-full overflow-hidden">
          <div className="flex-1 bg-green-400" />
          <div className="flex-1 bg-lime-400" />
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-red-500" />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-700 rounded-full shadow-md transition-all duration-700 ease-out"
          style={{ left: `calc(${clampedScore}% - 6px)` }}
        />
      </div>
    </div>
  );
}
