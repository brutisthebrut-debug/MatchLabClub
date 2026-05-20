import type { ComponentType, ReactNode, CSSProperties } from "react";

declare module "recharts" {
  interface PayloadEntry {
    name?: string;
    dataKey?: string | number;
    value?: unknown;
    type?: string;
    color?: string;
    fill?: string;
    unit?: string;
    payload?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface TooltipProps {
    active?: boolean;
    payload?: PayloadEntry[];
    label?: string | number;
    labelFormatter?: (label: string | number, payload: PayloadEntry[]) => ReactNode;
    labelClassName?: string;
    formatter?: (
      value: unknown,
      name: string,
      item: PayloadEntry,
      index: number,
      payload: PayloadEntry[]
    ) => ReactNode | [ReactNode, ReactNode];
    contentStyle?: CSSProperties;
    itemStyle?: CSSProperties;
    wrapperStyle?: CSSProperties;
    labelStyle?: CSSProperties;
    cursor?: boolean | object | ReactNode;
    separator?: string;
    offset?: number;
    filterNull?: boolean;
    isAnimationActive?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    children?: ReactNode;
    content?: ReactNode | ComponentType<TooltipProps>;
    [key: string]: unknown;
  }

  interface AxisProps {
    dataKey?: string | number | ((obj: unknown) => unknown);
    hide?: boolean;
    domain?: [unknown, unknown];
    tickFormatter?: (value: string | number, index: number) => string;
    tick?: boolean | object | ReactNode;
    tickLine?: boolean | object;
    axisLine?: boolean | object;
    stroke?: string;
    fontSize?: number;
    width?: number;
    height?: number;
    orientation?: "left" | "right" | "top" | "bottom";
    type?: "number" | "category";
    interval?: number | "preserveStart" | "preserveEnd" | "preserveStartEnd";
    minTickGap?: number;
    label?: string | number | object | ReactNode;
    children?: ReactNode;
    [key: string]: unknown;
  }

  interface LegendProps {
    wrapperStyle?: CSSProperties;
    iconType?: string;
    iconSize?: number;
    onClick?: (entry: { dataKey?: unknown; value?: unknown; [key: string]: unknown }) => void;
    onMouseEnter?: (entry: unknown) => void;
    onMouseLeave?: (entry: unknown) => void;
    formatter?: (value: string, entry: unknown) => ReactNode;
    children?: ReactNode;
    [key: string]: unknown;
  }

  type RechartsProps = Record<string, unknown>;

  export const Line: ComponentType<RechartsProps>;
  export const Bar: ComponentType<RechartsProps>;
  export const Area: ComponentType<RechartsProps>;
  export const XAxis: ComponentType<AxisProps>;
  export const YAxis: ComponentType<AxisProps>;
  export const Tooltip: ComponentType<TooltipProps>;
  export const Legend: ComponentType<LegendProps>;
  export const CartesianGrid: ComponentType<RechartsProps>;
  export const ResponsiveContainer: ComponentType<RechartsProps>;
  export const LineChart: ComponentType<RechartsProps>;
  export const BarChart: ComponentType<RechartsProps>;
  export const ComposedChart: ComponentType<RechartsProps>;
  export const AreaChart: ComponentType<RechartsProps>;
  export const RadialBarChart: ComponentType<RechartsProps>;
  export const RadialBar: ComponentType<RechartsProps>;
  export const PieChart: ComponentType<RechartsProps>;
  export const Pie: ComponentType<RechartsProps>;
  export const Cell: ComponentType<RechartsProps>;
  export const ReferenceLine: ComponentType<RechartsProps>;
  export const ReferenceArea: ComponentType<RechartsProps>;
}
