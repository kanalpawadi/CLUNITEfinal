"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Users, DollarSign, BarChart3, PieChart as PieChartIcon, Calendar } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts"
import { type NamedShare, type NamedValue, type ChartTooltipProps, type PieLabelProps, payloadNumber, payloadString } from "./chart-types"
import type { EventAnalytics, FinancialMetrics, TimeSeriesData } from "@/lib/analytics-data"

// Custom tooltip with glassmorphism effect
const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/90 backdrop-blur-xl border border-border rounded-xl p-4 shadow-soft-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-bold text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// Participants by Department Chart
export function ParticipantsByDepartmentChart({ data }: { data: NamedShare[] }) {
  const COLORS = ["hsl(var(--chart-2))", "hsl(var(--chart-2))", "hsl(var(--chart-5))", "hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--chart-1))", "hsl(var(--chart-2))"]

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl shadow-soft-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Participants by Department</CardTitle>
            <CardDescription>Distribution across academic departments</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px", fontWeight: 500 }} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px", fontWeight: 500 }}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={1500}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Participants by Year Chart
export function ParticipantsByYearChart({ data }: { data: NamedShare[] }) {
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--destructive))", "hsl(var(--chart-2))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--chart-1))", "hsl(var(--chart-2))"]

  if (!data || data.length === 0) {
    return (
      <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning rounded-xl shadow-soft-lg">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Participants by Year of Study</CardTitle>
              <CardDescription>Year-wise student distribution</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-sm text-muted-foreground">No data available. Participants need to fill in their year of study during event registration.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-warning rounded-xl shadow-soft-lg">
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Participants by Year of Study</CardTitle>
            <CardDescription>Year-wise student distribution</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: PieLabelProps) => `${props.name}: ${payloadNumber(props, "percentage").toFixed(0)}%`}
              outerRadius={100}
              fill="hsl(var(--chart-2))"
              dataKey="count"
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Event Comparison Chart
export function EventComparisonChart({ data }: { data: EventAnalytics[] }) {
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl shadow-soft-lg">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Event Performance Comparison</CardTitle>
            <CardDescription>Compare registrations and attendance across events</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="title"
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "11px", fontWeight: 500 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px", fontWeight: 500 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "13px", fontWeight: 600 }} />
            <Bar dataKey="registrations" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} name="Registrations" />
            <Bar dataKey="attendance" fill="hsl(var(--chart-5))" radius={[8, 8, 0, 0]} name="Attendance" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Registration by Category Chart
export function RegistrationByCategoryChart({ data }: { data: NamedValue[] }) {
  const COLORS = ["hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-1))", "hsl(var(--destructive))", "hsl(var(--chart-2))", "hsl(var(--chart-5))"]

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-success rounded-xl shadow-soft-lg">
            <PieChartIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Registrations by Category</CardTitle>
            <CardDescription>Event category distribution</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              animationDuration={1500}
              label={(props: PieLabelProps) => `${props.name} (${(Number(props.percent ?? 0) * 100).toFixed(0)}%)`}
              labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Income vs Expenses Chart
export function IncomeVsExpensesChart({ data }: { data: FinancialMetrics }) {
  const chartData = [
    { name: "Total Income", value: data.totalIncome, fill: "hsl(var(--chart-3))" },
    { name: "Total Expenses", value: data.totalExpenses, fill: "hsl(var(--destructive))" },
    { name: "Net Profit", value: data.netProfit, fill: data.netProfit >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))" },
  ]

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-success rounded-xl shadow-soft-lg">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Income vs Expenses</CardTitle>
            <CardDescription>Financial performance overview</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px", fontWeight: 500 }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px", fontWeight: 500 }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={<CustomTooltip />}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1500}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="p-3 bg-success/5 rounded-lg border border-success/20">
            <p className="text-xs text-success font-semibold mb-1">Total Income</p>
            <p className="text-lg font-bold text-success">₹{data.totalIncome.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
            <p className="text-xs text-destructive font-semibold mb-1">Total Expenses</p>
            <p className="text-lg font-bold text-destructive">₹{data.totalExpenses.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg border ${data.netProfit >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-primary/5 border-primary/20'}`}>
            <p className={`text-xs font-semibold mb-1 ${data.netProfit >= 0 ? 'text-primary' : 'text-primary'}`}>Net Profit</p>
            <p className={`text-lg font-bold ${data.netProfit >= 0 ? 'text-primary' : 'text-primary'}`}>
              ₹{data.netProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Expense Breakdown Chart
export function ExpenseBreakdownChart({ data }: { data: FinancialMetrics["expenseBreakdown"] }) {
  const COLORS = ["hsl(var(--destructive))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"]

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-destructive rounded-xl shadow-soft-lg">
            <PieChartIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Expense Breakdown</CardTitle>
            <CardDescription>Detailed expense allocation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: PieLabelProps) => `${payloadString(props, "category") || props.name}: ${payloadNumber(props, "percentage").toFixed(0)}%`}
              outerRadius={100}
              fill="hsl(var(--chart-2))"
              dataKey="amount"
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip />}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-background rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium text-foreground">{item.category}</span>
              </div>
              <span className="text-sm font-bold text-foreground">₹{item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Participants by Gender Chart
export function ParticipantsByGenderChart({ data }: { data: NamedShare[] }) {
  const COLORS = ["hsl(var(--chart-2))", "hsl(var(--chart-5))", "hsl(var(--chart-2))"]

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl shadow-soft-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Participants by Gender</CardTitle>
            <CardDescription>Gender distribution analysis</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={5}
              dataKey="count"
              animationDuration={1500}
              label={(props: PieLabelProps) => `${props.name}: ${payloadNumber(props, "percentage").toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Engagement Trends Over Time
export function EngagementTrendsOverTimeChart({ data }: { data: TimeSeriesData[] }) {
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl shadow-soft-lg">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Engagement Trends Over Time</CardTitle>
            <CardDescription>Registration and attendance patterns</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="registrationsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: "12px", fontWeight: 500 }}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px", fontWeight: 500 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "13px", fontWeight: 600 }} />
            <Area
              type="monotone"
              dataKey="registrations"
              fill="url(#registrationsGradient)"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              name="Registrations"
              animationDuration={2000}
            />
            <Line
              type="monotone"
              dataKey="attendance"
              stroke="hsl(var(--chart-5))"
              strokeWidth={3}
              dot={{ fill: "hsl(var(--chart-5))", r: 4 }}
              name="Attendance"
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
