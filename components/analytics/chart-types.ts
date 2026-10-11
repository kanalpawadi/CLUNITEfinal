import type { PieLabelRenderProps } from "recharts"

export type NamedShare = { name: string; count: number; percentage: number }
export type NamedValue = { name: string; value: number }
export type EngagementPoint = { month: string; engagement: number }
export type MetricValue = { metric: string; value: number }
export type MonthlyPoint = { month: string; participants: number; revenue: number }
export type SatisfactionPoint = { participants: number; satisfaction: number }
export type TypeValue = { type: string; value: number }

/** Props recharts injects into a custom tooltip `content` element. All optional so `<Tooltip content={<X />} />` type-checks. */
export interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{
    name?: string | number
    value?: string | number | ReadonlyArray<string | number>
    color?: string
    dataKey?: string | number
  }>
}

export type PieLabelProps = PieLabelRenderProps

/** Reads a numeric field from a pie slice payload (e.g. `percentage`). */
export function payloadNumber(props: PieLabelRenderProps, key: string): number {
  const payload: unknown = props.payload
  if (typeof payload === "object" && payload !== null && key in payload) {
    const value = (payload as Record<string, unknown>)[key]
    return typeof value === "number" ? value : 0
  }
  return 0
}

export function payloadString(props: PieLabelRenderProps, key: string): string | undefined {
  const payload: unknown = props.payload
  if (typeof payload === "object" && payload !== null && key in payload) {
    const value = (payload as Record<string, unknown>)[key]
    return typeof value === "string" ? value : undefined
  }
  return undefined
}
