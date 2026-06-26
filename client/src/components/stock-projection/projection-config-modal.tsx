import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, Clock, Package, BarChart3, Search, CheckCircle2, ChevronDown, ChevronUp,
  X, Zap, SlidersHorizontal, Truck, FileText, RefreshCw, Info, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectionOperations } from "@shared/stock-projection";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceFlags {
  loadingOrders: boolean;
  requests: boolean;
  movements: boolean;
  trips: boolean;
}

export type ConfigGranularity = "hour" | "shift" | "day" | "week";

export interface GenerateParams {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  granularity?: ConfigGranularity;
  eventIds: string[];
  productIds: string[];
  requestIds?: string[];
  orderIds?: string[];
  tripIds?: string[];
  movementIds?: string[];
  sources: SourceFlags;
  onlyShortages: boolean;
  onlyImpacted: boolean;
  useEventTripDates?: boolean;
}

export interface ProjectionConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialParams: GenerateParams;
  events?: any[];
  products?: any[];
  isGenerating: boolean;
  onApply: (params: GenerateParams) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAN_MAX_DAYS: Record<ConfigGranularity, number> = {
  hour: 7, shift: 31, day: 90, week: 365,
};
const GRAN_LABELS: Record<ConfigGranularity, string> = {
  hour: "Por hora", shift: "Por turno", day: "Por dia", week: "Por semana",
};

const SOURCE_DEFS = [
  { key: "loadingOrders" as const, label: "Ordens de carregamento", desc: "Status: pronta, aprovada ou em andamento", icon: FileText },
  { key: "requests" as const, label: "Requisições aprovadas", desc: "Aprovação total ou parcial — excluindo já consolidadas", icon: FileText },
  { key: "movements" as const, label: "Movimentações", desc: "Saídas e entradas físicas concluídas ou em andamento", icon: Truck },
  { key: "trips" as const, label: "Planos de viagem avulsos", desc: "Viagens sem vínculo a ordem de carregamento", icon: Truck },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(s: string, e: string): number {
  if (!s || !e || s > e) return 0;
  return Math.round((new Date(e + "T12:00:00Z").getTime() - new Date(s + "T12:00:00Z").getTime()) / 86400000) + 1;
}

function fmtDateFull(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    approved: "Aprovado", ready: "Pronto", in_progress: "Em andamento",
    cutoff_locked: "Bloqueado", completed: "Concluído", draft: "Rascunho",
    pending: "Pendente", pending_approval: "Aguard. aprovação",
  };
  return map[s] || s;
}

// ─── Summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({
  startDate, endDate, granularity, sources, selectedEventIds, selectedProductIds,
  selRequestIds, selOrderIds, selTripIds, selMovementIds,
  operations, onlyShortages, onlyImpacted, useEventTripDates,
}: {
  startDate: string; endDate: string; granularity: ConfigGranularity;
  sources: SourceFlags; selectedEventIds: string[]; selectedProductIds: string[];
  selRequestIds: Set<string> | null; selOrderIds: Set<string> | null;
  selTripIds: Set<string> | null; selMovementIds: Set<string> | null;
  operations?: ProjectionOperations;
  onlyShortages: boolean; onlyImpacted: boolean; useEventTripDates: boolean;
}) {
  const days = daysBetween(startDate, endDate);
  const activeSourceCount = Object.values(sources).filter(Boolean).length;

  const reqCount = selRequestIds !== null ? selRequestIds.size : (operations?.requests.length ?? 0);
  const ordCount = selOrderIds !== null ? selOrderIds.size : (operations?.orders.length ?? 0);
  const tripCount = selTripIds !== null ? selTripIds.size : (operations?.trips.length ?? 0);
  const movCount = selMovementIds !== null ? selMovementIds.size : (operations?.movements.length ?? 0);
  const hasOpsDetail = operations && selectedEventIds.length > 0;

  return (
    <div className="w-[280px] flex-shrink-0 border-l border-border/60 bg-muted/10 flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo da configuração</p>
      </div>

      <div className="px-4 py-4 space-y-5 text-sm">
        {/* Período */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Período
          </p>
          {startDate && endDate ? (
            <div className="space-y-0.5">
              <p className="font-medium text-foreground tabular-nums">{fmtDateFull(startDate)} → {fmtDateFull(endDate)}</p>
              <p className="text-xs text-muted-foreground">{days} {days === 1 ? "dia" : "dias"} · {GRAN_LABELS[granularity]}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Período não definido</p>
          )}
        </div>

        <Separator className="border-border/40" />

        {/* Fontes */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Fontes
          </p>
          <p className="font-medium">
            {activeSourceCount} {activeSourceCount === 1 ? "fonte ativa" : "fontes ativas"}
          </p>
          <div className="flex flex-wrap gap-1">
            {sources.movements && <Badge variant="secondary" className="text-xs">Movimentações</Badge>}
            {sources.loadingOrders && <Badge variant="secondary" className="text-xs">Ordens</Badge>}
            {sources.requests && <Badge variant="secondary" className="text-xs">Requisições</Badge>}
            {sources.trips && <Badge variant="secondary" className="text-xs">Viagens</Badge>}
          </div>
        </div>

        <Separator className="border-border/40" />

        {/* Eventos */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Eventos
          </p>
          {selectedEventIds.length > 0 ? (
            <p className="font-medium">{selectedEventIds.length} selecionado{selectedEventIds.length !== 1 ? "s" : ""}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Todos do período</p>
          )}
        </div>

        {/* Operações individuais */}
        {hasOpsDetail && (
          <>
            <Separator className="border-border/40" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Operações incluídas</p>
              <div className="space-y-1 text-xs">
                {sources.requests && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requisições</span>
                    <span className="font-medium tabular-nums">
                      {reqCount}{selRequestIds === null ? "" : ` / ${operations?.requests.length}`}
                    </span>
                  </div>
                )}
                {sources.loadingOrders && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ordens</span>
                    <span className="font-medium tabular-nums">
                      {ordCount}{selOrderIds === null ? "" : ` / ${operations?.orders.length}`}
                    </span>
                  </div>
                )}
                {sources.trips && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Viagens</span>
                    <span className="font-medium tabular-nums">
                      {tripCount}{selTripIds === null ? "" : ` / ${operations?.trips.length}`}
                    </span>
                  </div>
                )}
                {sources.movements && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Movimentações</span>
                    <span className="font-medium tabular-nums">
                      {movCount}{selMovementIds === null ? "" : ` / ${operations?.movements.length}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator className="border-border/40" />

        {/* Produtos */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Produtos
          </p>
          {selectedProductIds.length > 0 ? (
            <p className="font-medium">{selectedProductIds.length} selecionado{selectedProductIds.length !== 1 ? "s" : ""}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Todos os impactados</p>
          )}
        </div>

        <Separator className="border-border/40" />

        {/* Filtros de exibição */}
        {(onlyShortages || onlyImpacted || useEventTripDates) && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Filtros ativos</p>
            {onlyShortages && <p className="text-xs text-muted-foreground">· Apenas em falta</p>}
            {onlyImpacted && <p className="text-xs text-muted-foreground">· Apenas impactados</p>}
            {useEventTripDates && <p className="text-xs text-muted-foreground">· Modo Evento-Viagem</p>}
          </div>
        )}

        {/* Deduplicação */}
        <Separator className="border-border/40" />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Prioridade na deduplicação</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Movimentações {'>'} Ordens {'>'} Requisições {'>'} Viagens
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Period tab ───────────────────────────────────────────────────────────────

function PeriodTab({
  startDate, setStartDate, endDate, setEndDate,
  startTime, setStartTime, endTime, setEndTime,
  granularity, setGranularity,
}: {
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  startTime: string; setStartTime: (v: string) => void;
  endTime: string; setEndTime: (v: string) => void;
  granularity: ConfigGranularity; setGranularity: (v: ConfigGranularity) => void;
}) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const days = daysBetween(startDate, endDate);
  const maxDays = GRAN_MAX_DAYS[granularity];
  const granError = days > maxDays ? `Período (${days} dias) excede o máximo para "${GRAN_LABELS[granularity]}" (${maxDays} dias).` : null;

  const shortcuts = [
    { label: "Hoje", s: todayStr, e: todayStr },
    { label: "7 dias", s: todayStr, e: format(addDays(now, 6), "yyyy-MM-dd") },
    { label: "15 dias", s: todayStr, e: format(addDays(now, 14), "yyyy-MM-dd") },
    { label: "30 dias", s: todayStr, e: format(addDays(now, 29), "yyyy-MM-dd") },
    { label: "60 dias", s: todayStr, e: format(addDays(now, 59), "yyyy-MM-dd") },
    { label: "Semana atual", s: format(startOfWeek(now, { locale: ptBR }), "yyyy-MM-dd"), e: format(endOfWeek(now, { locale: ptBR }), "yyyy-MM-dd") },
    { label: "Próx. semana", s: format(startOfWeek(addDays(endOfWeek(now, { locale: ptBR }), 1), { locale: ptBR }), "yyyy-MM-dd"), e: format(endOfWeek(addDays(endOfWeek(now, { locale: ptBR }), 1), { locale: ptBR }), "yyyy-MM-dd") },
    { label: "Mês atual", s: format(startOfMonth(now), "yyyy-MM-dd"), e: format(endOfMonth(now), "yyyy-MM-dd") },
    { label: "Próx. mês", s: format(startOfMonth(addMonths(now, 1)), "yyyy-MM-dd"), e: format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd") },
  ];

  return (
    <div className="space-y-6">
      {/* Atalhos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atalhos rápidos</p>
        <div className="flex flex-wrap gap-1.5">
          {shortcuts.map((sc) => {
            const active = startDate === sc.s && endDate === sc.e;
            return (
              <Button
                key={sc.label}
                variant={active ? "default" : "outline"}
                size="sm"
                className={`h-7 text-xs px-2.5 ${active ? "" : "text-muted-foreground"}`}
                onClick={() => { setStartDate(sc.s); setEndDate(sc.e); }}
                data-testid={`shortcut-${sc.label.replace(/\s/g, "-").toLowerCase()}`}
              >
                {sc.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" data-testid="input-start-date" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Data final</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" data-testid="input-end-date" />
        </div>
      </div>

      {startDate && endDate && startDate <= endDate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Período: <span className="font-medium text-foreground">{fmtDateFull(startDate)}</span> até <span className="font-medium text-foreground">{fmtDateFull(endDate)}</span> · {days} {days === 1 ? "dia" : "dias"}</span>
        </div>
      )}

      {startDate && endDate && startDate > endDate && (
        <p className="text-xs text-destructive">Data inicial deve ser anterior ou igual à data final.</p>
      )}

      {/* Horários */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Janela horária (opcional)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hora inicial</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm" data-testid="input-start-time" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hora final</label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm" data-testid="input-end-time" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Refina a janela de análise dentro do período (útil para granularidade horária).</p>
      </div>

      {/* Granularidade */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Granularidade</p>
        <div className="grid grid-cols-2 gap-2">
          {(["hour", "shift", "day", "week"] as ConfigGranularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors text-sm ${
                granularity === g
                  ? "border-primary/50 bg-primary/8 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-muted/30"
              }`}
              data-testid={`granularity-${g}`}
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <div>
                <div className="font-medium leading-tight">{GRAN_LABELS[g]}</div>
                <div className="text-xs opacity-60">Máx. {GRAN_MAX_DAYS[g]} dias</div>
              </div>
            </button>
          ))}
        </div>
        {granError && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {granError}
          </p>
        )}
        {(granularity === "hour" || granularity === "shift") && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Granularidade horária e por turno estão em desenvolvimento — a projeção será calculada por dia até esta funcionalidade estar disponível.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Individual ops per event ─────────────────────────────────────────────────

function EventOpsSection({
  eventId, eventName, sources, operations,
  selRequestIds, setSelRequestIds,
  selOrderIds, setSelOrderIds,
  selTripIds, setSelTripIds,
  selMovementIds, setSelMovementIds,
}: {
  eventId: string; eventName: string;
  sources: SourceFlags; operations: ProjectionOperations;
  selRequestIds: Set<string> | null; setSelRequestIds: (v: Set<string> | null) => void;
  selOrderIds: Set<string> | null; setSelOrderIds: (v: Set<string> | null) => void;
  selTripIds: Set<string> | null; setSelTripIds: (v: Set<string> | null) => void;
  selMovementIds: Set<string> | null; setSelMovementIds: (v: Set<string> | null) => void;
}) {
  const reqs = operations.requests.filter(r => r.eventId === eventId);
  const ords = operations.orders.filter(o => o.eventId === eventId);
  const trps = operations.trips.filter(t => t.eventId === eventId);
  const movs = operations.movements.filter(m => m.eventId === eventId);

  const totalOps = (sources.requests ? reqs.length : 0) + (sources.loadingOrders ? ords.length : 0) + (sources.trips ? trps.length : 0) + (sources.movements ? movs.length : 0);
  if (totalOps === 0) return null;

  function toggleOp(set: Set<string> | null, setFn: (v: Set<string> | null) => void, allIds: string[], id: string) {
    if (set === null) {
      // all selected → start exclusion mode: all except this id
      const next = new Set(allIds);
      next.delete(id);
      if (next.size === allIds.length) setFn(null); else setFn(next);
    } else {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      const allIncluded = allIds.every(x => next.has(x));
      setFn(allIncluded ? null : next);
    }
  }

  function isChecked(set: Set<string> | null, id: string) {
    return set === null || set.has(id);
  }

  const OpRow = ({ id, label, sub, checked, onToggle }: { id: string; label: string; sub?: string; checked: boolean; onToggle: () => void }) => (
    <label className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/30"}`}>
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" data-testid={`op-${id}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium leading-tight truncate">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {checked && <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />}
    </label>
  );

  const allReqIds = reqs.map(r => r.id);
  const allOrdIds = ords.map(o => o.id);
  const allTrpIds = trps.map(t => t.id);
  const allMovIds = movs.map(m => m.id);

  return (
    <div className="border border-border/40 rounded-md divide-y divide-border/30 text-sm overflow-hidden mt-2">
      {sources.requests && reqs.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Requisições</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {selRequestIds === null ? reqs.length : reqs.filter(r => selRequestIds.has(r.id)).length} / {reqs.length}
            </span>
          </div>
          {reqs.map(r => (
            <OpRow key={r.id} id={r.id}
              label={`${r.area || "Área"}`}
              sub={`${statusLabel(r.status)}${r.totalQty > 0 ? ` · ${r.totalQty} un` : ""}`}
              checked={isChecked(selRequestIds, r.id)}
              onToggle={() => toggleOp(selRequestIds, setSelRequestIds, allReqIds, r.id)}
            />
          ))}
        </div>
      )}
      {sources.loadingOrders && ords.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Ordens de carregamento</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {selOrderIds === null ? ords.length : ords.filter(o => selOrderIds.has(o.id)).length} / {ords.length}
            </span>
          </div>
          {ords.map(o => (
            <OpRow key={o.id} id={o.id}
              label={o.orderNumber}
              sub={`${statusLabel(o.status)}${o.loadingDate ? ` · Carga: ${fmtDateFull(o.loadingDate)}` : ""}${o.totalQty > 0 ? ` · ${o.totalQty} un` : ""}`}
              checked={isChecked(selOrderIds, o.id)}
              onToggle={() => toggleOp(selOrderIds, setSelOrderIds, allOrdIds, o.id)}
            />
          ))}
        </div>
      )}
      {sources.trips && trps.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
            <Truck className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Planos de viagem</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {selTripIds === null ? trps.length : trps.filter(t => selTripIds.has(t.id)).length} / {trps.length}
            </span>
          </div>
          {trps.map(t => (
            <OpRow key={t.id} id={t.id}
              label={t.description || `Viagem ${t.id.slice(0, 8)}`}
              sub={`${statusLabel(t.status)}${t.departureDateTime ? ` · Saída: ${new Date(t.departureDateTime).toLocaleDateString("pt-BR")}` : ""}${t.totalQty > 0 ? ` · ${t.totalQty} un` : ""}`}
              checked={isChecked(selTripIds, t.id)}
              onToggle={() => toggleOp(selTripIds, setSelTripIds, allTrpIds, t.id)}
            />
          ))}
        </div>
      )}
      {sources.movements && movs.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
            <Truck className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Movimentações</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {selMovementIds === null ? movs.length : movs.filter(m => selMovementIds.has(m.id)).length} / {movs.length}
            </span>
          </div>
          {movs.map(m => (
            <OpRow key={m.id} id={m.id}
              label={`${m.movementNumber}${m.name ? ` — ${m.name}` : ""}`}
              sub={`${statusLabel(m.status)}${m.nature ? ` · ${m.nature === "outbound" ? "Saída" : "Entrada"}` : ""}${m.totalQty > 0 ? ` · ${m.totalQty} un` : ""}`}
              checked={isChecked(selMovementIds, m.id)}
              onToggle={() => toggleOp(selMovementIds, setSelMovementIds, allMovIds, m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sources/Events tab ───────────────────────────────────────────────────────

function SourcesTab({
  sources, setSources, useEventTripDates, setUseEventTripDates,
  events, selectedEventIds, setSelectedEventIds,
  operations, opsLoading,
  selRequestIds, setSelRequestIds,
  selOrderIds, setSelOrderIds,
  selTripIds, setSelTripIds,
  selMovementIds, setSelMovementIds,
}: {
  sources: SourceFlags; setSources: (v: SourceFlags) => void;
  useEventTripDates: boolean; setUseEventTripDates: (v: boolean) => void;
  events?: any[]; selectedEventIds: string[]; setSelectedEventIds: (v: string[]) => void;
  operations?: ProjectionOperations; opsLoading: boolean;
  selRequestIds: Set<string> | null; setSelRequestIds: (v: Set<string> | null) => void;
  selOrderIds: Set<string> | null; setSelOrderIds: (v: Set<string> | null) => void;
  selTripIds: Set<string> | null; setSelTripIds: (v: Set<string> | null) => void;
  selMovementIds: Set<string> | null; setSelMovementIds: (v: Set<string> | null) => void;
}) {
  const [eventSearch, setEventSearch] = useState("");
  const [expandedEventOpsIds, setExpandedEventOpsIds] = useState<Set<string>>(new Set());

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter((e: any) =>
      e.name?.toLowerCase().includes(q) || e.client?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  function toggleEvent(id: string) {
    setSelectedEventIds(selectedEventIds.includes(id) ? selectedEventIds.filter(x => x !== id) : [...selectedEventIds, id]);
  }
  function toggleExpandOps(id: string) {
    setExpandedEventOpsIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Fontes */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fontes de dados</p>
        <p className="text-xs text-muted-foreground">Prioridade na deduplicação: Movimentações {'>'} Ordens {'>'} Requisições {'>'} Viagens.</p>
        <div className="grid grid-cols-2 gap-2">
          {SOURCE_DEFS.map((s) => (
            <label key={s.key} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${sources[s.key] ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/30"}`}>
              <Checkbox checked={sources[s.key]} onCheckedChange={(v) => setSources({ ...sources, [s.key]: !!v })} className="mt-0.5" data-testid={`source-${s.key}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{s.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Modo Evento-Viagem */}
      <div className="flex items-center justify-between border border-border/60 rounded-md px-4 py-3">
        <div>
          <p className="text-sm font-medium">Modo Evento-Viagem</p>
          <p className="text-xs text-muted-foreground">Usa datas reais de partida e retorno das viagens de cada evento como janela de demanda.</p>
        </div>
        <Switch checked={useEventTripDates} onCheckedChange={setUseEventTripDates} data-testid="switch-event-trip-dates" />
      </div>

      {/* Eventos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Eventos
            {selectedEventIds.length > 0 && <Badge variant="secondary" className="text-xs ml-2">{selectedEventIds.length} selecionados</Badge>}
          </p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedEventIds((events || []).map((e: any) => e.id))} data-testid="button-select-all-events">Todos</Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedEventIds([])} disabled={selectedEventIds.length === 0} data-testid="button-clear-events">Limpar</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Sem seleção = todos os eventos do período serão incluídos.</p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar evento, cliente ou local..." value={eventSearch} onChange={e => setEventSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-event-search" />
        </div>

        <div className="border border-border/60 rounded-md divide-y divide-border/40 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{!events?.length ? "Nenhum evento disponível" : "Nenhum resultado"}</p>
          ) : filteredEvents.map((event: any) => {
            const isSelected = selectedEventIds.includes(event.id);
            const isExpanded = expandedEventOpsIds.has(event.id);
            const hasOps = operations && (
              operations.requests.some(r => r.eventId === event.id) ||
              operations.orders.some(o => o.eventId === event.id) ||
              operations.trips.some(t => t.eventId === event.id) ||
              operations.movements.some(m => m.eventId === event.id)
            );
            return (
              <div key={event.id}>
                <div className={`flex items-start gap-2.5 px-3 py-2.5 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                  <Checkbox id={`ev-${event.id}`} checked={isSelected} onCheckedChange={() => toggleEvent(event.id)} className="mt-0.5" data-testid={`event-${event.id}`} />
                  <label htmlFor={`ev-${event.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <div className="text-sm font-medium leading-tight">{event.name}</div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                      {event.eventDate && <span>{new Date(event.eventDate).toLocaleDateString("pt-BR")}</span>}
                      {event.location && <span>{event.location}</span>}
                      {event.client && <span>{event.client}</span>}
                    </div>
                  </label>
                  {isSelected && hasOps && (
                    <button type="button" onClick={() => toggleExpandOps(event.id)} className="flex items-center gap-1 text-xs text-primary hover-elevate rounded px-1.5 py-0.5 flex-shrink-0" data-testid={`expand-ops-${event.id}`}>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? "ocultar" : "operações"}
                    </button>
                  )}
                </div>
                {isSelected && isExpanded && operations && (
                  <div className="px-3 pb-3">
                    <EventOpsSection
                      eventId={event.id} eventName={event.name} sources={sources} operations={operations}
                      selRequestIds={selRequestIds} setSelRequestIds={setSelRequestIds}
                      selOrderIds={selOrderIds} setSelOrderIds={setSelOrderIds}
                      selTripIds={selTripIds} setSelTripIds={setSelTripIds}
                      selMovementIds={selMovementIds} setSelMovementIds={setSelMovementIds}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedEventIds.length > 0 && !operations && !opsLoading && (
          <p className="text-xs text-muted-foreground">Clique em "operações" ao lado de um evento para selecionar operações individuais.</p>
        )}
        {opsLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Buscando operações dos eventos selecionados...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Products tab ─────────────────────────────────────────────────────────────

function ProductsTab({ products, selectedProductIds, setSelectedProductIds }: {
  products?: any[]; selectedProductIds: string[]; setSelectedProductIds: (v: string[]) => void;
}) {
  const [productSearch, setProductSearch] = useState("");

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p: any) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [products, productSearch]);

  function toggleProduct(id: string) {
    setSelectedProductIds(selectedProductIds.includes(id) ? selectedProductIds.filter(x => x !== id) : [...selectedProductIds, id]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Filtrar produtos</p>
          <p className="text-xs text-muted-foreground">Sem seleção = todos os produtos impactados.</p>
        </div>
        {selectedProductIds.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedProductIds([])} data-testid="button-clear-products">
            <X className="w-3 h-3 mr-1" /> Limpar ({selectedProductIds.length})
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-product-search" />
      </div>

      <div className="border border-border/60 rounded-md divide-y divide-border/40 max-h-96 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{!products?.length ? "Nenhum produto disponível" : "Nenhum resultado"}</p>
        ) : filtered.slice(0, 200).map((p: any) => (
          <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${selectedProductIds.includes(p.id) ? "bg-primary/5" : "hover:bg-muted/40"}`}>
            <Checkbox checked={selectedProductIds.includes(p.id)} onCheckedChange={() => toggleProduct(p.id)} data-testid={`product-${p.id}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
            </div>
            {selectedProductIds.includes(p.id) && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
          </label>
        ))}
        {filtered.length > 200 && (
          <p className="text-xs text-muted-foreground text-center py-2">Mostrando 200 de {filtered.length}. Refine a busca.</p>
        )}
      </div>
    </div>
  );
}

// ─── Display tab ──────────────────────────────────────────────────────────────

function DisplayTab({ onlyShortages, setOnlyShortages, onlyImpacted, setOnlyImpacted }: {
  onlyShortages: boolean; setOnlyShortages: (v: boolean) => void;
  onlyImpacted: boolean; setOnlyImpacted: (v: boolean) => void;
}) {
  const opts = [
    { id: "shortages", checked: onlyShortages, onChange: setOnlyShortages, label: "Apenas produtos em falta", desc: "Mostra somente produtos com saldo negativo no período" },
    { id: "impacted", checked: onlyImpacted, onChange: setOnlyImpacted, label: "Apenas produtos impactados", desc: "Oculta produtos sem movimentação no período selecionado" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Filtros de exibição</p>
        <p className="text-xs text-muted-foreground">Aplicados após a projeção ser calculada.</p>
      </div>
      <div className="space-y-1">
        {opts.map(o => (
          <label key={o.id} className="flex items-start gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox id={`disp-${o.id}`} checked={o.checked} onCheckedChange={(v) => o.onChange(!!v)} data-testid={`display-${o.id}`} className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-xs text-muted-foreground">{o.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ProjectionConfigModal({
  open, onOpenChange, initialParams, events, products, isGenerating, onApply,
}: ProjectionConfigModalProps) {
  const [configMode, setConfigMode] = useState<"quick" | "advanced">(() => {
    try { return (sessionStorage.getItem("projection-config-mode") as any) || "advanced"; } catch { return "advanced"; }
  });
  const [activeTab, setActiveTab] = useState("period");

  // Period state
  const [startDate, setStartDate] = useState(initialParams.startDate);
  const [endDate, setEndDate] = useState(initialParams.endDate);
  const [startTime, setStartTime] = useState(initialParams.startTime || "00:00");
  const [endTime, setEndTime] = useState(initialParams.endTime || "23:59");
  const [granularity, setGranularity] = useState<ConfigGranularity>(initialParams.granularity || "day");

  // Sources
  const [sources, setSources] = useState<SourceFlags>({ ...initialParams.sources });
  const [useEventTripDates, setUseEventTripDates] = useState(initialParams.useEventTripDates || false);

  // Events
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([...(initialParams.eventIds || [])]);

  // Individual ops (null = all)
  const [selRequestIds, setSelRequestIds] = useState<Set<string> | null>(
    initialParams.requestIds ? new Set(initialParams.requestIds) : null
  );
  const [selOrderIds, setSelOrderIds] = useState<Set<string> | null>(
    initialParams.orderIds ? new Set(initialParams.orderIds) : null
  );
  const [selTripIds, setSelTripIds] = useState<Set<string> | null>(
    initialParams.tripIds ? new Set(initialParams.tripIds) : null
  );
  const [selMovementIds, setSelMovementIds] = useState<Set<string> | null>(
    initialParams.movementIds ? new Set(initialParams.movementIds) : null
  );

  // Products
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([...(initialParams.productIds || [])]);

  // Display
  const [onlyShortages, setOnlyShortages] = useState(initialParams.onlyShortages || false);
  const [onlyImpacted, setOnlyImpacted] = useState(initialParams.onlyImpacted || false);

  // Re-initialize when modal opens
  useEffect(() => {
    if (!open) return;
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
    setStartTime(initialParams.startTime || "00:00");
    setEndTime(initialParams.endTime || "23:59");
    setGranularity(initialParams.granularity || "day");
    setSources({ ...initialParams.sources });
    setUseEventTripDates(initialParams.useEventTripDates || false);
    setSelectedEventIds([...(initialParams.eventIds || [])]);
    setSelectedProductIds([...(initialParams.productIds || [])]);
    setOnlyShortages(initialParams.onlyShortages || false);
    setOnlyImpacted(initialParams.onlyImpacted || false);
    setSelRequestIds(initialParams.requestIds ? new Set(initialParams.requestIds) : null);
    setSelOrderIds(initialParams.orderIds ? new Set(initialParams.orderIds) : null);
    setSelTripIds(initialParams.tripIds ? new Set(initialParams.tripIds) : null);
    setSelMovementIds(initialParams.movementIds ? new Set(initialParams.movementIds) : null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset individual ops selections when events change
  useEffect(() => {
    setSelRequestIds(null);
    setSelOrderIds(null);
    setSelTripIds(null);
    setSelMovementIds(null);
  }, [selectedEventIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch operations for selected events (advanced mode only)
  const eventIdsKey = [...selectedEventIds].sort().join(",");
  const { data: operations, isLoading: opsLoading } = useQuery<ProjectionOperations>({
    queryKey: ["/api/reports/stock-projection/operations", eventIdsKey],
    enabled: open && configMode === "advanced" && selectedEventIds.length > 0 && !!eventIdsKey,
    staleTime: 60_000,
  });

  const anySource = sources.loadingOrders || sources.requests || sources.movements || sources.trips;
  const dateValid = !!(startDate && endDate && startDate <= endDate);
  const days = daysBetween(startDate, endDate);
  const granError = days > GRAN_MAX_DAYS[granularity];
  const canGenerate = dateValid && anySource && !granError;

  function setConfigModePersist(mode: "quick" | "advanced") {
    setConfigMode(mode);
    try { sessionStorage.setItem("projection-config-mode", mode); } catch { /* noop */ }
  }

  function handleApply() {
    if (!canGenerate) return;
    const params: GenerateParams = {
      startDate,
      endDate,
      startTime: startTime !== "00:00" ? startTime : undefined,
      endTime: endTime !== "23:59" ? endTime : undefined,
      granularity,
      eventIds: selectedEventIds,
      productIds: selectedProductIds,
      requestIds: selRequestIds !== null ? Array.from(selRequestIds) : undefined,
      orderIds: selOrderIds !== null ? Array.from(selOrderIds) : undefined,
      tripIds: selTripIds !== null ? Array.from(selTripIds) : undefined,
      movementIds: selMovementIds !== null ? Array.from(selMovementIds) : undefined,
      sources,
      onlyShortages,
      onlyImpacted,
      useEventTripDates,
    };
    onApply(params);
  }

  function handleClear() {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    setStartDate(todayStr);
    setEndDate(format(addDays(now, 29), "yyyy-MM-dd"));
    setStartTime("00:00");
    setEndTime("23:59");
    setGranularity("day");
    setSources({ loadingOrders: true, requests: true, movements: true, trips: false });
    setUseEventTripDates(false);
    setSelectedEventIds([]);
    setSelectedProductIds([]);
    setOnlyShortages(false);
    setOnlyImpacted(false);
    setSelRequestIds(null);
    setSelOrderIds(null);
    setSelTripIds(null);
    setSelMovementIds(null);
  }

  const isWide = configMode === "advanced";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 max-w-none"
        style={{ width: isWide ? "min(1250px, 92vw)" : "min(680px, 92vw)", maxHeight: "92vh" }}
        data-testid="projection-config-dialog"
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Configurar projeção de estoque
              </DialogTitle>
            </div>
            <div className="flex items-center gap-1 border border-border/60 rounded-md p-0.5">
              <Button
                variant={configMode === "quick" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfigModePersist("quick")}
                data-testid="mode-quick"
              >
                <Zap className="w-3 h-3 mr-1" /> Rápido
              </Button>
              <Button
                variant={configMode === "advanced" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfigModePersist("advanced")}
                data-testid="mode-advanced"
              >
                <SlidersHorizontal className="w-3 h-3 mr-1" /> Avançado
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {configMode === "quick" ? (
            /* ── Quick mode (single column) ─────────────────────────────── */
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Shortcuts */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período rápido</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Hoje", s: format(new Date(), "yyyy-MM-dd"), e: format(new Date(), "yyyy-MM-dd") },
                    { label: "7 dias", s: format(new Date(), "yyyy-MM-dd"), e: format(addDays(new Date(), 6), "yyyy-MM-dd") },
                    { label: "30 dias", s: format(new Date(), "yyyy-MM-dd"), e: format(addDays(new Date(), 29), "yyyy-MM-dd") },
                    { label: "Mês atual", s: format(startOfMonth(new Date()), "yyyy-MM-dd"), e: format(endOfMonth(new Date()), "yyyy-MM-dd") },
                  ].map(sc => (
                    <Button key={sc.label} variant={startDate === sc.s && endDate === sc.e ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => { setStartDate(sc.s); setEndDate(sc.e); }}>
                      {sc.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" data-testid="quick-start-date" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data final</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm" data-testid="quick-end-date" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fontes</p>
                <div className="space-y-2">
                  {SOURCE_DEFS.map(s => (
                    <label key={s.key} className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${sources[s.key] ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/30"}`}>
                      <Checkbox checked={sources[s.key]} onCheckedChange={(v) => setSources({ ...sources, [s.key]: !!v })} />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/30">
                  <Checkbox checked={onlyShortages} onCheckedChange={(v) => setOnlyShortages(!!v)} />
                  <span className="text-sm">Apenas produtos em falta</span>
                </label>
                <label className="flex items-center gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/30">
                  <Checkbox checked={onlyImpacted} onCheckedChange={(v) => setOnlyImpacted(!!v)} />
                  <span className="text-sm">Apenas produtos impactados</span>
                </label>
              </div>
            </div>
          ) : (
            /* ── Advanced mode (two columns) ─────────────────────────────── */
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Main — tabs */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 pt-4 pb-0 flex-shrink-0 border-b border-border/40">
                    <TabsList className="h-8">
                      <TabsTrigger value="period" className="text-xs h-7" data-testid="tab-period">
                        <Calendar className="w-3.5 h-3.5 mr-1" /> Período
                      </TabsTrigger>
                      <TabsTrigger value="sources" className="text-xs h-7" data-testid="tab-sources">
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Fontes e Eventos
                        {selectedEventIds.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs px-1">{selectedEventIds.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="products" className="text-xs h-7" data-testid="tab-products">
                        <Package className="w-3.5 h-3.5 mr-1" /> Produtos
                        {selectedProductIds.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs px-1">{selectedProductIds.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="display" className="text-xs h-7" data-testid="tab-display">
                        <BarChart3 className="w-3.5 h-3.5 mr-1" /> Exibição
                        {(onlyShortages || onlyImpacted) && <Badge variant="secondary" className="ml-1.5 text-xs px-1">!</Badge>}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="period" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden" style={{ scrollbarWidth: "thin" }}>
                    <PeriodTab
                      startDate={startDate} setStartDate={setStartDate}
                      endDate={endDate} setEndDate={setEndDate}
                      startTime={startTime} setStartTime={setStartTime}
                      endTime={endTime} setEndTime={setEndTime}
                      granularity={granularity} setGranularity={setGranularity}
                    />
                  </TabsContent>
                  <TabsContent value="sources" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden" style={{ scrollbarWidth: "thin" }}>
                    <SourcesTab
                      sources={sources} setSources={setSources}
                      useEventTripDates={useEventTripDates} setUseEventTripDates={setUseEventTripDates}
                      events={events} selectedEventIds={selectedEventIds} setSelectedEventIds={setSelectedEventIds}
                      operations={operations} opsLoading={opsLoading}
                      selRequestIds={selRequestIds} setSelRequestIds={setSelRequestIds}
                      selOrderIds={selOrderIds} setSelOrderIds={setSelOrderIds}
                      selTripIds={selTripIds} setSelTripIds={setSelTripIds}
                      selMovementIds={selMovementIds} setSelMovementIds={setSelMovementIds}
                    />
                  </TabsContent>
                  <TabsContent value="products" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden" style={{ scrollbarWidth: "thin" }}>
                    <ProductsTab products={products} selectedProductIds={selectedProductIds} setSelectedProductIds={setSelectedProductIds} />
                  </TabsContent>
                  <TabsContent value="display" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden" style={{ scrollbarWidth: "thin" }}>
                    <DisplayTab onlyShortages={onlyShortages} setOnlyShortages={setOnlyShortages} onlyImpacted={onlyImpacted} setOnlyImpacted={setOnlyImpacted} />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Summary panel */}
              <SummaryPanel
                startDate={startDate} endDate={endDate}
                granularity={granularity} sources={sources}
                selectedEventIds={selectedEventIds} selectedProductIds={selectedProductIds}
                selRequestIds={selRequestIds} selOrderIds={selOrderIds}
                selTripIds={selTripIds} selMovementIds={selMovementIds}
                operations={operations}
                onlyShortages={onlyShortages} onlyImpacted={onlyImpacted}
                useEventTripDates={useEventTripDates}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border/60 px-6 py-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear-config">
            <X className="w-3.5 h-3.5 mr-1.5" /> Limpar filtros
          </Button>
          <div className="flex-1" />
          {!anySource && <p className="text-xs text-destructive">Selecione ao menos uma fonte de dados.</p>}
          {granError && <p className="text-xs text-destructive">Período excede o limite da granularidade.</p>}
          <Button
            onClick={handleApply}
            disabled={!canGenerate || isGenerating}
            data-testid="button-generate"
          >
            {isGenerating
              ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Calculando...</>
              : <><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Gerar projeção</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
