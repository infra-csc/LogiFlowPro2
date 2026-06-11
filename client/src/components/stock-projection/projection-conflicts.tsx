import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  PanelRightOpen,
} from "lucide-react";
import type {
  ProjectionConflict,
  ProjectionLink,
  StockProjectionResult,
} from "@shared/stock-projection";
import { sourceLabel } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onOpenDetail?: (conflict: ProjectionConflict) => void;
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              data-testid={`link-conflict-${l.type}-${l.id}`}
            >
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

function ConflictRow({
  c,
  idx,
  tone,
  onOpenDetail,
}: {
  c: ProjectionConflict;
  idx: number;
  tone: "error" | "warning";
  onOpenDetail?: (conflict: ProjectionConflict) => void;
}) {
  const Icon = tone === "error" ? AlertTriangle : Info;
  const color = tone === "error" ? "text-destructive" : "text-chart-5";
  const border =
    tone === "error"
      ? "border-destructive/20 bg-destructive/5"
      : "border-chart-5/20 bg-chart-5/5";
  return (
    <div
      className={`p-3 border ${border} rounded-md`}
      data-testid={`conflict-${tone}-${idx}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">
              {c.productName
                ? c.productName
                : `${sourceLabel(c.source)}: ${c.sourceLabel}`}
              {c.sku && (
                <span className="text-muted-foreground font-normal"> · {c.sku}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {KIND_LABEL[c.kind]}
              </Badge>
              {onOpenDetail && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onOpenDetail(c)}
                  data-testid={`button-conflict-detail-${tone}-${idx}`}
                  aria-label="Ver detalhes do conflito"
                >
                  <PanelRightOpen className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>

          {(c.deficit != null && c.deficit > 0) || c.projectedBalance != null ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              {c.projectedBalance != null && (
                <span>
                  Saldo previsto:{" "}
                  <span className="tabular-nums font-medium">{c.projectedBalance}</span>
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

// ─── Checklist item for the clean empty state ─────────────────────────────────

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="w-4 h-4 text-chart-4 flex-shrink-0" />
      {label}
    </div>
  );
}

export function ProjectionConflicts({ result, onOpenDetail }: Props) {
  const errors = result.conflicts.filter((c) => c.severity === "error");
  const warnings = result.conflicts.filter((c) => c.severity === "warning");

  if (result.conflicts.length === 0) {
    return (
      <div className="space-y-3" data-testid="conflicts-empty">
        {/* Compact positive card */}
        <Card className="border-chart-4/40">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-chart-4/10 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-chart-4" />
            </span>
            <div>
              <p className="font-semibold">Nenhum conflito detectado</p>
              <p className="text-sm text-muted-foreground">
                A projeção não encontrou saldos negativos nem inconsistências.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validation checklist */}
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Validações concluídas
            </p>
            <CheckItem label="Todas as saídas foram associadas a uma data válida" />
            <CheckItem label="Nenhum saldo negativo previsto no período analisado" />
            <CheckItem label="Nenhum produto abaixo do estoque mínimo detectado" />
            <CheckItem label="Nenhuma origem com data ou quantidade inconsistente" />
            <CheckItem label="Todas as fontes selecionadas foram processadas com sucesso" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="font-semibold text-base text-destructive">
                Conflitos ({errors.length})
              </p>
            </div>
            <div className="space-y-2">
              {errors.map((c, idx) => (
                <ConflictRow
                  key={idx}
                  c={c}
                  idx={idx}
                  tone="error"
                  onOpenDetail={onOpenDetail}
                />
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
              <p className="font-semibold text-base text-chart-5">
                Avisos ({warnings.length})
              </p>
            </div>
            <div className="space-y-2">
              {warnings.map((c, idx) => (
                <ConflictRow
                  key={idx}
                  c={c}
                  idx={idx}
                  tone="warning"
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
