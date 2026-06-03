import type {
  ProjectionDayStatus,
  ProjectionSource,
  ConsideredSituation,
} from "@shared/stock-projection";

export function statusLabel(status: ProjectionDayStatus): string {
  switch (status) {
    case "shortage":
      return "Falta";
    case "low":
      return "Abaixo do mínimo";
    default:
      return "Adequado";
  }
}

// Tailwind classes for a colored badge per status (follows the existing
// chart-4 / chart-5 / destructive convention used across reports).
export function statusBadgeClass(status: ProjectionDayStatus): string {
  switch (status) {
    case "shortage":
      return "bg-destructive text-destructive-foreground";
    case "low":
      return "bg-chart-5/20 text-chart-5 border border-chart-5/30";
    default:
      return "bg-chart-4/20 text-chart-4 border border-chart-4/30";
  }
}

// Background tint for matrix cells based on the day status.
export function cellToneClass(status: ProjectionDayStatus): string {
  switch (status) {
    case "shortage":
      return "bg-destructive/15 text-destructive font-semibold";
    case "low":
      return "bg-chart-5/15 text-chart-5";
    default:
      return "text-foreground";
  }
}

// Background tint for day-view rows.
export function rowToneClass(status: ProjectionDayStatus): string {
  switch (status) {
    case "shortage":
      return "bg-destructive/5";
    case "low":
      return "bg-chart-5/5";
    default:
      return "";
  }
}

export function formatDay(dayKey: string): string {
  // dayKey is yyyy-MM-dd (UTC day). Render as dd/MM without TZ drift.
  const [, m, d] = dayKey.split("-");
  return `${d}/${m}`;
}

export function formatDayFull(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function weekdayShort(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  return WEEKDAYS[d.getUTCDay()] || "";
}

export function isWeekend(dayKey: string): boolean {
  const day = new Date(`${dayKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isToday(dayKey: string): boolean {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return dayKey === todayKey;
}

export const SOURCE_LABEL: Record<ProjectionSource, string> = {
  request: "Requisição",
  loading_order: "Ordem de carregamento",
  movement: "Movimentação",
  trip: "Viagem",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source as ProjectionSource] || source;
}

export function situationLabel(s: ConsideredSituation): string {
  switch (s) {
    case "considered":
      return "Considerado";
    case "partial":
      return "Parcial";
    case "ignored":
      return "Ignorado";
    case "no_date":
      return "Sem data";
  }
}

export function situationBadgeClass(s: ConsideredSituation): string {
  switch (s) {
    case "considered":
      return "bg-chart-4/20 text-chart-4 border border-chart-4/30";
    case "partial":
      return "bg-chart-5/20 text-chart-5 border border-chart-5/30";
    case "ignored":
      return "bg-muted text-muted-foreground border border-border/60";
    case "no_date":
      return "bg-destructive/15 text-destructive border border-destructive/30";
  }
}

// Net day direction used to render ↓ / ↑ / ↔ trend glyphs in the matrix.
export type DayTrend = "down" | "up" | "flat";

export function dayTrend(outbound: number, inbound: number): DayTrend {
  const net = inbound - outbound;
  if (net < 0) return "down";
  if (net > 0) return "up";
  return "flat";
}

// Heatmap background for a matrix cell. Neutral when the day has no flow and is
// healthy; otherwise a subtle severity wash so risk reads at a glance.
export function cellHeatClass(status: ProjectionDayStatus, hasImpact: boolean): string {
  switch (status) {
    case "shortage":
      return "bg-destructive/20 text-destructive font-semibold";
    case "low":
      return "bg-chart-5/15 text-chart-5";
    default:
      return hasImpact ? "bg-chart-4/10 text-foreground" : "text-muted-foreground";
  }
}

// Small status dot used in legends / headers.
export function statusDotClass(status: ProjectionDayStatus): string {
  switch (status) {
    case "shortage":
      return "bg-destructive";
    case "low":
      return "bg-chart-5";
    default:
      return "bg-chart-4";
  }
}

export interface KpiMeta {
  key: string;
  label: string;
  tooltip: string;
}

// Tooltips that explain how each executive KPI is computed.
export const KPI_TOOLTIPS: Record<string, string> = {
  totalProducts: "Produtos com pelo menos um movimento (entrada/saída) no período.",
  productsShortage: "Produtos cujo saldo projetado fica negativo em algum dia.",
  productsLow: "Produtos que ficam abaixo do estoque mínimo em algum dia.",
  productsOk: "Produtos que permanecem acima do mínimo em todo o período.",
  totalOutbound: "Soma de todas as saídas previstas no período.",
  totalInbound: "Soma de todas as entradas/retornos previstos no período.",
  totalReserved: "Soma, por produto, do pico de quantidade reservada no período.",
  totalInEvent: "Soma, por produto, do pico de quantidade em evento no período.",
};
