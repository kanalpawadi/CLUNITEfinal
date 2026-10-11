"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Activity, Users, Target, Zap, BarChart3 } from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Legend,
  Scatter,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import { type EngagementPoint, type MetricValue, type MonthlyPoint, type NamedValue, type SatisfactionPoint, type TypeValue, type ChartTooltipProps, type PieLabelProps, payloadNumber, payloadString } from "./chart-types"

// Modern gradient definitions
const gradients = {
  orange: { start: "hsl(var(--chart-1))", end: "hsl(var(--chart-1))" },
  purple: { start: "hsl(var(--chart-2))", end: "hsl(var(--chart-5))" },
  blue: { start: "hsl(var(--chart-2))", end: "hsl(var(--chart-2))" },
  green: { start: "hsl(var(--chart-2))", end: "hsl(var(--chart-3))" },
  pink: { start: "hsl(var(--chart-5))", end: "hsl(var(--destructive))" },
  teal: { start: "hsl(var(--chart-3))", end: "hsl(var(--chart-3))" },
}

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

// Engagement Trends Chart with Gradient Area
export function EngagementTrendsChart({ data }: { data: EngagementPoint[] }) {
  // Ensure minimum data for visibility
  const chartData = data.length > 0 ? data : [
    { month: 'No Data', engagement: 0 }
  ]
  
  // Calculate max value for better scaling
  const maxValue = Math.max(...chartData.map(d => d.engagement || 0), 5)
  
  const hasData = data.length > 0 && data.some(d => d.engagement > 0)
  
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-lg shadow-soft">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Engagement Trends</CardTitle>
            <CardDescription className="text-xs">Participant engagement over time</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No engagement data yet</p>
            <p className="text-xs text-muted-foreground">Data will appear as participants register</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                domain={[0, maxValue + 2]}
                allowDataOverflow={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                fill="url(#engagementGradient)"
                animationDuration={1500}
                dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Multi-metric Performance Chart
export function PerformanceOverviewChart({ data }: { data: MetricValue[] }) {
  // Ensure minimum values for visibility
  const chartData = data.map(item => ({
    ...item,
    value: Math.max(item.value || 0, 5) // Minimum 5 for visibility
  }))
  
  const hasData = data.some(d => d.value > 0)
  
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-success rounded-lg shadow-soft">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Performance Overview</CardTitle>
            <CardDescription className="text-xs">Multi-dimensional performance analysis</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[350px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-3">
              <Target className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No performance data yet</p>
            <p className="text-xs text-muted-foreground">Metrics will appear as you host events</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <defs>
                <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--chart-2))" }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 10 }}
              />
              <Radar
                name="Performance"
                dataKey="value"
                stroke="hsl(var(--chart-2))"
                fill="url(#radarGradient)"
                fillOpacity={0.6}
                strokeWidth={2.5}
                animationDuration={1500}
                dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Monthly Trends with Dual Axis
export function MonthlyTrendsChart({ data }: { data: MonthlyPoint[] }) {
  const hasData = data.length > 0 && data.some(d => d.participants > 0 || d.revenue > 0)
  
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-lg shadow-soft">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Monthly Trends</CardTitle>
              <CardDescription className="text-xs">Participation and revenue over time</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No monthly data yet</p>
            <p className="text-xs text-muted-foreground">Trends will appear as you host events</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="participantsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "15px", fontSize: "11px", fontWeight: 600 }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="participants"
                fill="url(#participantsGradient)"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2.5}
                animationDuration={1500}
                dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
              />
              <Bar
                yAxisId="right"
                dataKey="revenue"
                fill="hsl(var(--chart-2))"
                radius={[6, 6, 0, 0]}
                animationDuration={1500}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Event Categories Distribution with Modern Donut
export function EventCategoriesChart({ data }: { data: NamedValue[] }) {
  const COLORS = ["hsl(var(--chart-2))", "hsl(var(--chart-5))", "hsl(var(--chart-5))", "hsl(var(--destructive))", "hsl(var(--chart-2))", "hsl(var(--chart-2))"]
  
  const hasData = data.length > 0 && data.some(d => d.value > 0)

  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-lg shadow-soft">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Event Categories</CardTitle>
              <CardDescription className="text-xs">Distribution by category</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No category data yet</p>
            <p className="text-xs text-muted-foreground">Create events to see distribution</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                animationDuration={1500}
                label={({ name, percent }: PieLabelProps) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                style={{ fontSize: '11px', fontWeight: 600 }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Participants vs Satisfaction Scatter Plot
export function ParticipantsSatisfactionChart({ data }: { data: SatisfactionPoint[] }) {
  const hasData = data.length > 0 && data.some(d => d.participants > 0)
  
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-lg shadow-soft">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Participants vs Satisfaction</CardTitle>
            <CardDescription className="text-xs">Event size and satisfaction correlation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No satisfaction data yet</p>
            <p className="text-xs text-muted-foreground">Data will appear after events complete</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="participants"
                name="Participants"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                label={{ value: 'Participants', position: 'insideBottom', offset: -5, fontSize: 11 }}
              />
              <YAxis
                dataKey="satisfaction"
                name="Satisfaction"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                domain={[0, 5]}
                label={{ value: 'Rating', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter
                name="Events"
                dataKey="satisfaction"
                fill="hsl(var(--chart-5))"
                shape="circle"
                animationDuration={1500}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(var(--chart-5) / ${0.5 + (entry.satisfaction / 10) * 0.5})`}
                    r={6}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Event Type Analysis with Gradient Bars
export function EventTypeAnalysisChart({ data }: { data: TypeValue[] }) {
  const hasData = data.length > 0 && data.some(d => d.value > 0)
  
  return (
    <Card className="border-none shadow-soft-lg hover:shadow-soft-lg transition-all duration-300 bg-card">
      <CardHeader className="border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-destructive rounded-lg shadow-soft">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Event Type Analysis</CardTitle>
            <CardDescription className="text-xs">Performance by event type</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
              <BarChart3 className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No event type data yet</p>
            <p className="text-xs text-muted-foreground">Create different event types to see analysis</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="type"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                fill="url(#barGradient)"
                radius={[0, 6, 6, 0]}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
