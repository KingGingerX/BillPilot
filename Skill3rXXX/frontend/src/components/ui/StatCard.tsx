interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  trend?: number; // percentage change
  color?: "green" | "blue" | "purple" | "orange";
}

const COLOR_MAP = {
  green:  "text-green-400",
  blue:   "text-blue-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
};

export default function StatCard({
  label, value, subValue, icon, trend, color = "green",
}: StatCardProps) {
  const colorClass = COLOR_MAP[color];

  return (
    <div className="stat-card hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className={`stat-value ${colorClass}`}>{value}</div>

      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span
            className={`text-xs font-medium ${
              trend >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {subValue && <span className="text-xs text-gray-500">{subValue}</span>}
      </div>
    </div>
  );
}
