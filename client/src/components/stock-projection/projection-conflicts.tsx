import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle2, Lightbulb, ExternalLink } from "lucide-react";
import type { ProjectionConflict, ProjectionLink, StockProjectionResult } from "@shared/stock-projection";
import { sourceLabel } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

const KIND_LABEL: Record<ProjectionConflict["kind"], string> = {
  shortage: "Saldo",
  missing_data: "Falta de dado",
  ambiguous: "Ambiguidade",
};

function LinkButtons({ links }: { links?: ProjectionLink[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map((l, i) =>
        l.href ? (
          <Link key={`${l.type}-${l.id}-${i}`} href={l.href}>
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`link-conflict-${l.type}-${l.id}`}>
              <ExternalLink className="w-3 h-3 mr-1" />
              {l.label}
            </Button>
          </Link>
        ) : (
          <Badge key={`${l.type}-${l.id}-${i}`} variant="secondary" className="text-xs">
            {l.label}
          </Badge>
        ),
      )}
    </div>
  );
}

function ConflictRow({ c, idx, tone }: { c: ProjectionConflict; idx: number; tone: "error" | "warning" }) {
  const Icon = tone === "error" ? AlertTriangle : Info;
  const color = tone === "error" ? "text-destructive" : "text-chart-5";
  const border = tone === "error" ? "border-destructive/20 bg-destructive/5" : "border-chart-5/20 bg-chart-5/5";
  return (
    <div className={`p-3 border ${border} rounded-md`} data-testid={`conflict-${tone}-${idx}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">
              {c.productName ? c.productName : `${sourceLabel(c.source)}: ${c.sourceLabel}`}
              {c.sku && <span className="text-muted-foreground font-normal"> · {c.sku}</span>}
            </div>
            <Badge variant="secondary" className="text-xs">
              {KIND_LABEL[c.kind]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>

          {(c.deficit != null && c.deficit > 0) || c.projectedBalance != null ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              {c.projectedBalance != null && (
                <span>
                  Saldo previsto: <span className="tabular-nums font-medium">{c.projectedBalance}</span>
                </span>
              )}
              {c.minimumStock != null && (
                <span className="text-muted-foreground">
                  Mínimo: <span className="tabular-nums">{c.minimumStock}</span>
                </span>
              )}
              {c.deficit != null && c.deficit > 0 && (
                <span className={color}>
                  Déficit: <span className="tabular-nums font-medium">{c.deficit}</span>
                </span>
              )}
            </div>
          ) : null}

          {c.suggestedAction && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-foreground/90">
              <Lightbulb className="w-3.5 h-3.5 text-chart-5 flex-shrink-0 mt-0.5" />
              <span>{c.suggestedAction}</span>
            </div>
          )}

          <LinkButtons links={c.links} />
        </div>
      </div>
    </div>
  );
}

export function ProjectionConflicts({ result }: Props) {
  const errors = result.conflicts.filter((c) => c.severity === "error");
  const warnings = result.conflicts.filter((c) => c.severity === "warning");

  if (result.conflicts.length === 0) {
    return (
      <Card className="border-chart-4/40">
        <CardContent className="p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-chart-4 flex-shrink-0" />
          <div>
            <p className="font-semibold text-base">Nenhum conflito detectado</p>
            <p className="text-sm text-muted-foreground">
              Todas as origens puderam ser datadas e não há saldo negativo previsto.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="font-semibold text-base text-destructive">Conflitos ({errors.length})</p>
            </div>
            <div className="space-y-2">
              {errors.map((c, idx) => (
                <ConflictRow key={idx} c={c} idx={idx} tone="error" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="border-chart-5/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-chart-5" />
              <p className="font-semibold text-base text-chart-5">Avisos ({warnings.length})</p>
            </div>
            <div className="space-y-2">
              {warnings.map((c, idx) => (
                <ConflictRow key={idx} c={c} idx={idx} tone="warning" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
