/**
 * RevenueChart — line chart for daily revenue using Chart.js.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DayRevenue {
  date: string;
  revenueInCents: number;
}

interface RevenueChartProps {
  data: DayRevenue[];
  title?: string;
}

export default function RevenueChart({ data, title = "Revenue" }: RevenueChartProps) {
  const labels = data.map((d) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const values = data.map((d) => d.revenueInCents / 100);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Revenue ($)",
        data: values,
        fill: true,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#22c55e",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1f2937",
        borderColor: "#374151",
        borderWidth: 1,
        titleColor: "#d1d5db",
        bodyColor: "#9ca3af",
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            ` $${ctx.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#1f2937" },
        ticks: { color: "#6b7280", maxRotation: 45 },
      },
      y: {
        grid: { color: "#1f2937" },
        ticks: {
          color: "#6b7280",
          callback: (v: number | string) =>
            `$${Number(v).toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wide">
        {title}
      </h3>
      <div className="h-64">
        <Line data={chartData} options={options as never} />
      </div>
    </div>
  );
}
