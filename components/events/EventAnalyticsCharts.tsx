"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type PieLabelRenderProps,
} from "recharts"

export function DailyRegistrationsChart({ data }: { data: { date: string; registrations: number }[] }) {
  const dailyRegistrations = data
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={dailyRegistrations}>
        <defs>
          <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b" 
          tickFormatter={(date) => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
        />
        <YAxis stroke="#64748b" />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "none",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          labelFormatter={(date) => {
            return new Date(date).toLocaleDateString();
          }}
        />
        <Area
          type="monotone"
          dataKey="registrations"
          stroke="#6366f1"
          fillOpacity={1}
          fill="url(#colorRegistrations)"
          name="Registrations"
        />
        <Legend verticalAlign="top" height={36} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DemographicsPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const demographicData = data
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={demographicData}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label={(props: PieLabelRenderProps) => `${props.name} (${(Number(props.percent ?? 0) * 100).toFixed(0)}%)`}
        >
          {demographicData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => [`${value} participants`]}
          contentStyle={{
            backgroundColor: "white",
            border: "none",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
        />
        <Legend 
          formatter={(value, entry) => {
            return <span style={{ color: entry.color }}>{value}</span>;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
