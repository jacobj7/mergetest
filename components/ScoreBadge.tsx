const ScoreBadge = ({ score }: { score: number }) => {
  const getColorClass = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const colorClass = getColorClass(score);

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${colorClass}`}
    >
      {score}
    </span>
  );
};

export default ScoreBadge;
