import type { ProjectionDayStatus } from "@shared/stock-projection";

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

export function formatDay(dayKey: string): string {
  // dayKey is yyyy-MM-dd (UTC day). Render as dd/MM without TZ drift.
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}`;
}

export function formatDayFull(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
}
