import type { Filters } from "@/lib/analytics";
import type { Capabilities, Demand, TabInfo } from "@/lib/types";

export interface DrillRequest {
  title: string;
  subtitle?: string;
  rows: Demand[];
  apply?: Partial<Filters>;
}

export interface ChartCtx {
  today: string;
  buColors: Record<string, string>;
  buOrder: string[];
  tabs: TabInfo[];
  filters: Filters;
  capabilities: Capabilities;
  drill: (req: DrillRequest) => void;
  navigate: (regional: string | null, team: string | null) => void;
}

export interface ChartProps {
  rows: Demand[];
  ctx: ChartCtx;
  className?: string;
}
