import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Plus, Truck, CalendarDays, MapPin, X, List,
  ArrowRight, CheckCircle2, Loader2, Clock, ChevronLeft, ChevronRight,
  AlertTriangle, User, Anchor, ChevronsRight, RotateCcw,
  MoreVertical, Pencil, PackageCheck, AlignJustify, AlignLeft,
  CalendarClock, Circle, CircleCheck, CircleDot,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  format, startOfDay, endOfDay, parseISO, startOfWeek, endOfWeek,
  addWeeks, addDays, isSameDay, differenceInMinutes, isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Trip, Event, Vehicle, VehicleType, Driver, Dock } from "@shared/schema";
import { TripDialog } from "@/components/trip-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/components/filter-bar";
import {
  ToggleGroup, ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripWithRelations extends Trip {
  event?: Event;
  vehicle?: Vehicle;
  vehicleType?: VehicleType;
  driver?: Driver;
  dock?: Dock;
  destinations?: Array<{ id: string; location: string; arrivalDateTime?: string }>;
}

// Extra new fields (cast via (trip as any) or this interface)
interface TripExtra {
  vehiclePlate?: string;
  outboundArrivalDateTime?: string;
  outboundArrivalLocation?: string;
  sameTransportReturn?: boolean;
  returnVehicleTypeId?: string;
  returnDriverId?: string;
  returnDockId?: string;
  returnLoadingLocation?: string;
  returnLoadingStartTime?: string;
  returnLoadingEndTime?: string;
  returnDepartureDateTime?: string;
  returnArrivalDateTime?: string;
  returnUnloadingLocation?: string;
  returnUnloadingStartTime?: string;
  returnUnloadingEndTime?: string;
}

type FullTrip = TripWithRelations & TripExtra;

interface TripFilters {
  eventDate?: string;
  eventId?: string;
  movementDate?: string;
  statusGroup?: "planned" | "in_progress" | "completed";
  withPendencies?: boolean;
}

interface CalendarTripEntry {
  trip: FullTrip;
  type: "loading" | "unloading" | "departure" | "event";
}

type ViewMode = "list" | "calendar";
type SortBy = "nextActivity" | "loading" | "departure" | "event";
type CalendarPeriod = "week" | "biweekly";
type Density = "compact" | "detailed";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDT(ts?: string | Date | null): string {
  if (!ts) return "";
  try { return format(new Date(ts as string), "dd/MM HH:mm", { locale: ptBR }); } catch { return ""; }
}

function fmtDate(ts?: string | Date | null): string {
  if (!ts) return "";
  try { return format(new Date(ts as string), "dd/MM/yyyy", { locale: ptBR }); } catch { return ""; }
}

function fmtTime(ts?: string | Date | null): string {
  if (!ts) return "";
  try { return format(new Date(ts as string), "HH:mm", { locale: ptBR }); } catch { return ""; }
}

function fmtRange(a?: string | Date | null, b?: string | Date | null): string {
  if (!a) return "—";
  const aStr = fmtDT(a);
  if (!b) return aStr;
  const aDate = format(new Date(a as string), "dd/MM");
  const bDate = format(new Date(b as string), "dd/MM");
  if (aDate === bDate) return `${aDate} ${fmtTime(a)} – ${fmtTime(b)}`;
  return `${fmtDT(a)} – ${fmtDT(b)}`;
}

function relativeTime(dt: Date, now: Date): string {
  const diff = differenceInMinutes(dt, now);
  if (diff < 0) {
    const late = -diff;
    if (late < 60) return `há ${late}min`;
    if (late < 1440) return `há ${Math.floor(late / 60)}h`;
    return `há ${Math.floor(late / 1440)}d`;
  }
  if (diff === 0) return "agora";
  if (diff < 60) return `em ${diff}min`;
  if (diff < 1440) return `em ${Math.floor(diff / 60)}h`;
  if (diff < 2880) return "amanhã";
  return `em ${Math.floor(diff / 1440)}d`;
}

// ── Operational logic ─────────────────────────────────────────────────────────

const STATUS_STAGE_LABEL: Record<string, string> = {
  planned: "Aguardando carregamento no CD",
  loading: "Carregando no CD",
  loaded: "Carregado — aguardando saída",
  in_transit: "Em trânsito para o evento",
  at_destination: "No evento — aguardando descarga",
  unloading: "Descarregando no evento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function operationalStageLabel(status: string): string {
  return STATUS_STAGE_LABEL[status] || status;
}

interface NextActivity {
  label: string;
  datetime: Date;
  isLate: boolean;
}

function getNextActivity(trip: FullTrip, now: Date): NextActivity | null {
  const entries: Array<{ label: string; ts?: string | Date | null }> = [
    { label: "Início do carregamento no CD", ts: trip.loadingStartTime },
    { label: "Fim do carregamento no CD", ts: trip.loadingEndTime },
    { label: "Saída do CD", ts: trip.departureDateTime },
    { label: "Chegada ao evento", ts: trip.outboundArrivalDateTime },
    { label: "Início da descarga no evento", ts: trip.unloadingStartTime },
    { label: "Fim da descarga no evento", ts: trip.unloadingEndTime },
    { label: "Início do carregamento na desmontagem", ts: trip.returnLoadingStartTime },
    { label: "Saída do evento", ts: trip.returnDepartureDateTime },
    { label: "Chegada ao CD", ts: trip.returnArrivalDateTime },
    { label: "Início da descarga no CD", ts: trip.returnUnloadingStartTime },
    { label: "Fim da descarga no CD", ts: trip.returnUnloadingEndTime },
  ];
  const valid = entries
    .filter((e) => e.ts)
    .map((e) => ({ label: e.label, datetime: new Date(e.ts as string) }))
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

  const future = valid.filter((e) => e.datetime > now);
  if (future.length > 0) return { ...future[0], isLate: false };

  if (trip.status !== "completed" && valid.length > 0) {
    const last = valid[valid.length - 1];
    return { ...last, isLate: true };
  }
  return null;
}

function getNextActivityTimestamp(trip: FullTrip): number {
  const now = new Date();
  const na = getNextActivity(trip, now);
  if (na) return na.datetime.getTime();
  if (trip.loadingStartTime) return new Date(trip.loadingStartTime).getTime();
  if (trip.event?.eventDate) return new Date(trip.event.eventDate).getTime();
  return Infinity;
}

function getPendencies(trip: FullTrip): string[] {
  const p: string[] = [];
  if (!trip.driverId) p.push("Motorista não informado");
  if (!trip.vehiclePlate && !trip.vehicle?.plate) p.push("Placa não informada");
  if (!trip.dockId) p.push("Doca de saída não definida");
  if (!trip.departureDateTime) p.push("Data de saída do CD não informada");
  if (!trip.outboundArrivalDateTime) p.push("Chegada ao evento não informada");
  const hasReturn = trip.returnLoadingStartTime || trip.returnDepartureDateTime;
  if (!hasReturn) {
    p.push("Retorno ao CD ainda não planejado");
  } else {
    if (!trip.returnDockId) p.push("Doca de retorno não definida");
    if (!trip.returnArrivalDateTime) p.push("Chegada ao CD não informada");
    if (!trip.returnUnloadingStartTime) p.push("Descarga no CD sem horário");
  }
  return p;
}

// ── STATS config ──────────────────────────────────────────────────────────────

const STATS = [
  {
    label: "Total",
    icon: Truck,
    key: undefined as undefined,
    filter: (_: FullTrip) => true,
  },
  {
    label: "Agendadas",
    icon: Clock,
    key: "planned" as const,
    filter: (t: FullTrip) => t.status === "planned",
  },
  {
    label: "Em Andamento",
    icon: Loader2,
    key: "in_progress" as const,
    filter: (t: FullTrip) =>
      ["loading", "loaded", "in_transit", "at_destination", "unloading"].includes(t.status),
  },
  {
    label: "Concluídas",
    icon: CheckCircle2,
    key: "completed" as const,
    filter: (t: FullTrip) => t.status === "completed",
  },
] as const;

// ── TripCard ──────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: FullTrip;
  canWrite: boolean;
  onEdit: (trip: FullTrip) => void;
  docks: Dock[];
  density: Density;
}

function TripCard({ trip, canWrite, onEdit, docks, density }: TripCardProps) {
  const [showPendencies, setShowPendencies] = useState(false);
  const now = new Date();
  const nextActivity = getNextActivity(trip, now);
  const pendencies = getPendencies(trip);
  const hasPendencies = pendencies.length > 0;

  // Derived values
  const plate = trip.vehiclePlate || trip.vehicle?.plate;
  const vehicleLabel = [trip.vehicleType?.name, plate].filter(Boolean).join(" • ");
  const driverLabel = trip.driver?.name;
  const outboundDock = trip.dock?.name || (trip.dockId ? docks.find((d) => d.id === trip.dockId)?.name : undefined);
  const returnDock = trip.returnDockId ? docks.find((d) => d.id === trip.returnDockId)?.name : undefined;
  const hasReturn = !!(trip.returnLoadingStartTime || trip.returnDepartureDateTime || trip.returnArrivalDateTime);
  const stageLabel = operationalStageLabel(trip.status);
  const isCompleted = trip.status === "completed";

  // ── Row: section heading ──
  function JourneyHeading({ dir, icon: Icon, color }: { dir: string; icon: React.ElementType; color: string }) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide pb-1.5 border-b border-border/40", color)}>
        <Icon className="h-3 w-3" />
        {dir}
      </div>
    );
  }

  // ── Row: one timeline entry ──
  function TimelineRow({ label, value, dim }: { label: string; value?: string; dim?: boolean }) {
    if (!value) return null;
    return (
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className="text-muted-foreground w-32 shrink-0 leading-tight">{label}</span>
        <span className={cn("font-medium leading-tight", dim && "text-muted-foreground")}>{value}</span>
      </div>
    );
  }

  // ── Compact mode ──
  if (density === "compact") {
    return (
      <Card
        className="border-border/60 hover-elevate"
        data-testid={`card-trip-${trip.id}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              {/* Row 1: status + description */}
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={trip.status} />
                <span className="text-sm font-semibold truncate">
                  {trip.description || trip.event?.name || "Plano sem descrição"}
                </span>
              </div>
              {/* Row 2: event + transport */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {trip.event?.name && trip.description && (
                  <span className="truncate max-w-[200px]">{trip.event.name}</span>
                )}
                {trip.event?.eventDate && (
                  <span>{fmtDate(trip.event.eventDate)}</span>
                )}
                {vehicleLabel && <><span className="text-border/60">·</span><span>{vehicleLabel}</span></>}
                {driverLabel && <><span className="text-border/60">·</span><span>{driverLabel}</span></>}
              </div>
              {/* Row 3: next activity */}
              {nextActivity && (
                <div className={cn(
                  "flex items-center gap-1.5 text-xs",
                  nextActivity.isLate ? "text-amber-500" : "text-primary"
                )}>
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{nextActivity.label}</span>
                  <span className="text-muted-foreground">
                    {nextActivity.isLate ? "(" : ""}{fmtDT(nextActivity.datetime)}{nextActivity.isLate ? " — atrasado)" : ""}
                  </span>
                  <span className="ml-auto text-muted-foreground">{relativeTime(nextActivity.datetime, now)}</span>
                </div>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {hasPendencies && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 cursor-pointer"
                  onClick={() => setShowPendencies((p) => !p)}>
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  {pendencies.length}
                </Badge>
              )}
              {canWrite && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(trip)}
                  aria-label="Editar" data-testid={`button-edit-trip-${trip.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {/* Pendencies expansion */}
          {showPendencies && hasPendencies && (
            <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
              {pendencies.map((p, i) => (
                <p key={i} className="text-xs text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {p}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Detailed mode ──
  return (
    <Card
      className="border-border/60 hover-elevate"
      data-testid={`card-trip-${trip.id}`}
    >
      <CardContent className="p-4 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <StatusBadge status={trip.status} />
              <h3 className="font-semibold text-sm leading-tight">
                {trip.description || trip.event?.name || "Plano sem descrição"}
              </h3>
            </div>
            {/* Event info row */}
            {trip.event && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{trip.event.name}</span>
                {trip.event.eventDate && <span>{fmtDate(trip.event.eventDate)}</span>}
                {trip.event.location && (
                  <>
                    <span className="text-border/60">·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />{trip.event.location}
                    </span>
                  </>
                )}
                {trip.event.client && (
                  <>
                    <span className="text-border/60">·</span>
                    <span>{trip.event.client}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Ações"
                    data-testid={`button-actions-trip-${trip.id}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(trip)} data-testid={`button-edit-trip-${trip.id}`}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar plano
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── Etapa + Próxima atividade ── */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleDot className="h-3 w-3 shrink-0" />
            <span>Etapa atual: <span className="text-foreground font-medium">{stageLabel}</span></span>
          </div>
          {nextActivity && (
            <div className={cn(
              "flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5",
              nextActivity.isLate
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-500"
                : "bg-primary/5 border border-primary/20 text-primary"
            )}>
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{nextActivity.label}</span>
              <span className="text-muted-foreground">
                {fmtDT(nextActivity.datetime)}
              </span>
              <span className="ml-auto font-semibold">
                {nextActivity.isLate ? "Atrasado " : ""}{relativeTime(nextActivity.datetime, now)}
              </span>
            </div>
          )}
          {isCompleted && !nextActivity && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <CircleCheck className="h-3.5 w-3.5" />
              <span className="font-medium">{stageLabel}</span>
            </div>
          )}
        </div>

        {/* ── Transporte ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs border-t border-b border-border/40 py-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Truck className="h-3 w-3" />
            <span className="font-medium text-foreground">{vehicleLabel || "Não informado"}</span>
          </span>
          <span className="text-border/50">|</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            <span className={cn("font-medium", driverLabel ? "text-foreground" : "text-muted-foreground")}>
              {driverLabel || "Motorista não informado"}
            </span>
          </span>
          <span className="text-border/50">|</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Anchor className="h-3 w-3" />
            <span className={cn("font-medium", outboundDock ? "text-foreground" : "text-muted-foreground")}>
              {outboundDock || "Doca não definida"}
            </span>
            {(outboundDock || returnDock) && (
              <>
                <ArrowRight className="h-2.5 w-2.5 mx-0.5" />
                <span className={cn("font-medium", returnDock ? "text-foreground" : "text-muted-foreground")}>
                  {returnDock || "—"}
                </span>
              </>
            )}
          </span>
        </div>

        {/* ── Ida / Volta ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* IDA */}
          <div className="space-y-1.5">
            <JourneyHeading dir="Ida — CD → Evento" icon={ArrowRight} color="text-primary/80" />
            <TimelineRow label="Carregamento no CD"
              value={fmtRange(trip.loadingStartTime, trip.loadingEndTime)} />
            <TimelineRow label="Saída do CD" value={fmtDT(trip.departureDateTime)} />
            <TimelineRow label="Chegada ao evento" value={fmtDT(trip.outboundArrivalDateTime)} />
            <TimelineRow label="Descarga no evento"
              value={fmtRange(trip.unloadingStartTime, trip.unloadingEndTime)} />
            {!trip.loadingStartTime && !trip.departureDateTime && !trip.unloadingStartTime && (
              <p className="text-xs text-muted-foreground italic">Horários da ida não definidos</p>
            )}
          </div>

          {/* VOLTA */}
          <div className="space-y-1.5">
            <JourneyHeading dir="Volta — Evento → CD" icon={RotateCcw} color="text-muted-foreground" />
            {hasReturn ? (
              <>
                <TimelineRow label="Carregamento na desmontagem"
                  value={fmtRange(trip.returnLoadingStartTime, trip.returnLoadingEndTime)} />
                <TimelineRow label="Saída do evento" value={fmtDT(trip.returnDepartureDateTime)} />
                <TimelineRow label="Chegada ao CD" value={fmtDT(trip.returnArrivalDateTime)} />
                <TimelineRow label="Descarga no CD"
                  value={fmtRange(trip.returnUnloadingStartTime, trip.returnUnloadingEndTime)} />
              </>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground italic">Retorno ainda não planejado</p>
                {canWrite && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => onEdit(trip)}
                  >
                    Planejar retorno →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: rota + pendências ── */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
          {/* Route */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1 min-w-0 flex-wrap">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{outboundDock || "CD"}</span>
            {(trip.destinations?.length ?? 0) > 0 ? (
              <>
                <ChevronsRight className="h-3 w-3" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="underline decoration-dotted cursor-help">
                      {trip.destinations!.length} parada{trip.destinations!.length > 1 ? "s" : ""}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {trip.destinations!.map((d, i) => (
                      <div key={d.id} className="text-xs">{i + 1}. {d.location}</div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </>
            ) : null}
            <ChevronsRight className="h-3 w-3" />
            <span className="truncate max-w-[160px]">{trip.event?.name || "Evento"}</span>
            {returnDock && (
              <>
                <ChevronsRight className="h-3 w-3" />
                <span>{returnDock}</span>
              </>
            )}
          </div>

          {/* Pendencies */}
          {hasPendencies && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-amber-500 hover:underline"
                onClick={() => setShowPendencies((p) => !p)}
              >
                <AlertTriangle className="h-3 w-3" />
                {pendencies.length} pendência{pendencies.length > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>

        {/* Pendencies list */}
        {showPendencies && hasPendencies && (
          <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-2.5 space-y-1">
            {pendencies.map((p, i) => (
              <p key={i} className="text-xs text-amber-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {p}
              </p>
            ))}
          </div>
        )}

        {/* Notes */}
        {trip.notes && (
          <div className="pt-1 border-t border-border/40">
            <p className="text-xs text-muted-foreground">{trip.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Trips() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | undefined>();
  const [filters, setFilters] = useState<TripFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("nextActivity");
  const [calendarPeriod, setCalendarPeriod] = useState<CalendarPeriod>("week");
  const [calendarStartDate, setCalendarStartDate] = useState(
    startOfWeek(new Date(), { locale: ptBR })
  );
  const [density, setDensity] = useState<Density>(() => {
    try { return (sessionStorage.getItem("trips-density") as Density) || "detailed"; } catch { return "detailed"; }
  });

  const { data: trips, isLoading } = useQuery<FullTrip[]>({
    queryKey: ["/api/trips"],
  });
  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: docks = [] } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const setDensityPersist = (d: Density) => {
    setDensity(d);
    try { sessionStorage.setItem("trips-density", d); } catch { /* ignore */ }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.eventDate) count++;
    if (filters.eventId) count++;
    if (filters.movementDate) count++;
    if (filters.statusGroup) count++;
    if (filters.withPendencies) count++;
    return count;
  }, [filters]);

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      if (filters.eventDate) {
        if (!trip.event?.eventDate) return false;
        const eventDate = startOfDay(new Date(trip.event.eventDate));
        const filterDate = startOfDay(parseISO(filters.eventDate));
        if (eventDate.getTime() !== filterDate.getTime()) return false;
      }
      if (filters.eventId && trip.eventId !== filters.eventId) return false;
      if (filters.movementDate) {
        const filterDate = startOfDay(parseISO(filters.movementDate));
        const filterDateEnd = endOfDay(parseISO(filters.movementDate));
        let match = false;
        for (const ts of [trip.loadingStartTime, trip.unloadingStartTime, (trip as any).returnLoadingStartTime]) {
          if (ts && new Date(ts) >= filterDate && new Date(ts) <= filterDateEnd) { match = true; break; }
        }
        if (!match) return false;
      }
      if (filters.statusGroup) {
        const inProgress = ["loading", "loaded", "in_transit", "at_destination", "unloading"];
        if (filters.statusGroup === "planned" && trip.status !== "planned") return false;
        if (filters.statusGroup === "in_progress" && !inProgress.includes(trip.status)) return false;
        if (filters.statusGroup === "completed" && trip.status !== "completed") return false;
      }
      if (filters.withPendencies && getPendencies(trip).length === 0) return false;
      return true;
    });
  }, [trips, filters]);

  const sortedTrips = useMemo(() => {
    return [...filteredTrips].sort((a, b) => {
      if (sortBy === "nextActivity") return getNextActivityTimestamp(a) - getNextActivityTimestamp(b);
      if (sortBy === "departure") {
        const da = a.departureDateTime ? new Date(a.departureDateTime).getTime() : Infinity;
        const db = b.departureDateTime ? new Date(b.departureDateTime).getTime() : Infinity;
        return da - db;
      }
      if (sortBy === "event") {
        const da = a.event?.eventDate ? new Date(a.event.eventDate).getTime() : Infinity;
        const db = b.event?.eventDate ? new Date(b.event.eventDate).getTime() : Infinity;
        return da - db;
      }
      // loading (default)
      const da = a.loadingStartTime ? new Date(a.loadingStartTime).getTime() : Infinity;
      const db = b.loadingStartTime ? new Date(b.loadingStartTime).getTime() : Infinity;
      return da - db;
    });
  }, [filteredTrips, sortBy]);

  const calendarEndDate = useMemo(() => {
    if (calendarPeriod === "week") return endOfWeek(calendarStartDate, { locale: ptBR });
    return endOfWeek(addWeeks(calendarStartDate, 1), { locale: ptBR });
  }, [calendarStartDate, calendarPeriod]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let cur = calendarStartDate;
    while (cur <= calendarEndDate) { days.push(cur); cur = addDays(cur, 1); }
    return days;
  }, [calendarStartDate, calendarEndDate]);

  const tripsByDate = useMemo(() => {
    const grouped: Record<string, CalendarTripEntry[]> = {};
    sortedTrips.forEach((trip) => {
      let placed = false;
      if (trip.loadingStartTime) {
        const key = format(new Date(trip.loadingStartTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "loading" });
        placed = true;
      }
      if (trip.unloadingStartTime) {
        const key = format(new Date(trip.unloadingStartTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "unloading" });
        placed = true;
      }
      if (!placed && trip.departureDateTime) {
        const key = format(new Date(trip.departureDateTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "departure" });
        placed = true;
      }
      if (!placed && trip.event?.eventDate) {
        const key = format(new Date(trip.event.eventDate), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "event" });
      }
    });
    return grouped;
  }, [sortedTrips]);

  const handleEdit = (trip: FullTrip) => {
    setSelectedTrip(trip as Trip);
    setShowDialog(true);
  };

  const handleClose = () => { setSelectedTrip(undefined); setShowDialog(false); };
  const clearFilters = () => setFilters({});
  const navigateCalendar = (dir: "prev" | "next") => {
    const weeks = calendarPeriod === "week" ? 1 : 2;
    setCalendarStartDate(addWeeks(calendarStartDate, dir === "next" ? weeks : -weeks));
  };
  const goToToday = () => setCalendarStartDate(startOfWeek(new Date(), { locale: ptBR }));

  if (isLoading) return <PageLoading message="Carregando planos de viagens..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planejamento de Transporte"
        description="Agende e gerencie planos de viagens, veículos, rotas e carregamentos."
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-trip">
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano de Viagens
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      {trips && trips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map(({ label, icon: Icon, key, filter }) => {
            const count = trips.filter(filter).length;
            const active = filters.statusGroup === key && key !== undefined;
            return (
              <Card
                key={label}
                className={cn(
                  "border-border/60 hover-elevate cursor-pointer transition-all",
                  active && "ring-1 ring-primary border-primary/40"
                )}
                onClick={() => setFilters((p) => ({
                  ...p, statusGroup: p.statusGroup === key ? undefined : key,
                }))}
                data-testid={`stat-card-${label.toLowerCase().replace(/ /g, "-")}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary/70" />
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums leading-none">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Controls bar */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <ToggleGroup
              type="single" value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="border border-border/60 rounded-md p-0.5"
            >
              <ToggleGroupItem value="list" aria-label="Lista"
                className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                data-testid="toggle-view-list">
                <List className="h-3.5 w-3.5 mr-1.5" /> Lista
              </ToggleGroupItem>
              <ToggleGroupItem value="calendar" aria-label="Calendário"
                className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                data-testid="toggle-view-calendar">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Calendário
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Density toggle (list only) */}
            {viewMode === "list" && (
              <ToggleGroup
                type="single" value={density}
                onValueChange={(v) => v && setDensityPersist(v as Density)}
                className="border border-border/60 rounded-md p-0.5"
              >
                <ToggleGroupItem value="detailed" aria-label="Detalhado"
                  className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  data-testid="toggle-density-detailed">
                  <AlignJustify className="h-3.5 w-3.5 mr-1.5" /> Detalhado
                </ToggleGroupItem>
                <ToggleGroupItem value="compact" aria-label="Compacto"
                  className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  data-testid="toggle-density-compact">
                  <AlignLeft className="h-3.5 w-3.5 mr-1.5" /> Compacto
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            {/* Sort (list only) */}
            {viewMode === "list" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-xs text-muted-foreground whitespace-nowrap">
                  Ordenar por
                </Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger id="sort-by" className="w-[190px] h-8 text-sm" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nextActivity">Próxima atividade</SelectItem>
                    <SelectItem value="loading">Data de carregamento</SelectItem>
                    <SelectItem value="departure">Data de saída do CD</SelectItem>
                    <SelectItem value="event">Data do evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Calendar period */}
            {viewMode === "calendar" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="calendar-period" className="text-xs text-muted-foreground whitespace-nowrap">
                  Período
                </Label>
                <Select value={calendarPeriod} onValueChange={(v) => setCalendarPeriod(v as CalendarPeriod)}>
                  <SelectTrigger id="calendar-period" className="w-[130px] h-8 text-sm"
                    data-testid="select-calendar-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="biweekly">Quinzena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <FilterBar badgeCount={activeFilterCount} onClear={clearFilters}>
        <div className="space-y-1.5">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filters.statusGroup || "all"}
            onValueChange={(v) => setFilters((p) => ({
              ...p, statusGroup: v === "all" ? undefined : (v as TripFilters["statusGroup"]),
            }))}
          >
            <SelectTrigger id="filter-status" className="h-8 text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="planned">Agendadas</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-event" className="text-xs text-muted-foreground">Evento</Label>
          <Select
            value={filters.eventId || "all"}
            onValueChange={(v) => setFilters((p) => ({ ...p, eventId: v === "all" ? undefined : v }))}
          >
            <SelectTrigger id="filter-event" className="h-8 text-sm" data-testid="select-filter-event">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {events?.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>{ev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-event-date" className="text-xs text-muted-foreground">Data do Evento</Label>
          <div className="flex gap-1">
            <Input
              id="filter-event-date" type="date" value={filters.eventDate || ""}
              onChange={(e) => setFilters((p) => ({ ...p, eventDate: e.target.value || undefined }))}
              className="h-8 text-sm flex-1" data-testid="input-filter-event-date"
            />
            {filters.eventDate && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setFilters((p) => ({ ...p, eventDate: undefined }))}
                data-testid="button-clear-event-date">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-movement-date" className="text-xs text-muted-foreground">Movimentações do Dia</Label>
          <div className="flex gap-1">
            <Input
              id="filter-movement-date" type="date" value={filters.movementDate || ""}
              onChange={(e) => setFilters((p) => ({ ...p, movementDate: e.target.value || undefined }))}
              className="h-8 text-sm flex-1" data-testid="input-filter-movement-date"
            />
            {filters.movementDate && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setFilters((p) => ({ ...p, movementDate: undefined }))}
                data-testid="button-clear-movement-date">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Carregamento ou descarregamento</p>
        </div>

        <div className="space-y-1.5 flex flex-col">
          <Label className="text-xs text-muted-foreground">Pendências</Label>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, withPendencies: !p.withPendencies }))}
            className={cn(
              "h-8 px-3 rounded-md border text-xs font-medium transition-colors",
              filters.withPendencies
                ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                : "border-border/60 text-muted-foreground hover-elevate"
            )}
            data-testid="button-filter-pendencies"
          >
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Com pendências
          </button>
        </div>
      </FilterBar>

      {/* ── LISTA ── */}
      {viewMode === "list" && (
        <>
          {sortedTrips.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={activeFilterCount > 0 ? "Nenhum plano de viagens encontrado" : "Nenhum plano de viagens agendado"}
              description={
                activeFilterCount > 0
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Comece a planejar o transporte para seus eventos."
              }
              action={
                activeFilterCount === 0 && canWrite
                  ? { label: "Novo Plano de Viagens", onClick: () => setShowDialog(true) }
                  : activeFilterCount > 0
                  ? { label: "Limpar filtros", onClick: clearFilters }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {sortedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  canWrite={canWrite}
                  onEdit={handleEdit}
                  docks={docks}
                  density={density}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CALENDÁRIO ── */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateCalendar("prev")}
                  data-testid="button-calendar-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {format(calendarStartDate, "dd 'de' MMMM", { locale: ptBR })} –{" "}
                    {format(calendarEndDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <Button variant="ghost" size="sm" onClick={goToToday}
                    className="h-6 text-xs mt-0.5" data-testid="button-calendar-today">
                    Hoje
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateCalendar("next")}
                  data-testid="button-calendar-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayTrips = tripsByDate[dayKey] || [];
              const todayFlag = isSameDay(day, new Date());
              return (
                <Card
                  key={dayKey}
                  className={cn("border-border/60", todayFlag && "ring-1 ring-primary border-primary/40")}
                  data-testid={`calendar-day-${dayKey}`}
                >
                  <div className="p-3 pb-2">
                    <div className="text-xs font-normal flex items-center justify-between">
                      <span className="capitalize text-muted-foreground">
                        {format(day, "EEE", { locale: ptBR })}
                      </span>
                      <span className={cn(
                        "text-sm font-semibold",
                        todayFlag && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                      )}>
                        {format(day, "dd")}
                      </span>
                    </div>
                  </div>
                  <div className="px-2 pb-2 space-y-1">
                    {dayTrips.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/50 text-center py-2">—</p>
                    ) : (
                      dayTrips.map(({ trip, type }) => (
                        <div
                          key={`${trip.id}-${type}`}
                          className="p-1.5 rounded text-[10px] bg-primary/10 border border-primary/20 cursor-pointer hover-elevate"
                          onClick={() => canWrite && handleEdit(trip)}
                          data-testid={`calendar-trip-${trip.id}`}
                        >
                          <div className="font-medium truncate text-primary/90">
                            {trip.description || trip.event?.name || "Plano"}
                          </div>
                          <div className="text-muted-foreground truncate">
                            {type === "loading" && trip.loadingStartTime && `Carg. ${fmtTime(trip.loadingStartTime)}`}
                            {type === "unloading" && trip.unloadingStartTime && `Descarg. ${fmtTime(trip.unloadingStartTime)}`}
                            {type === "departure" && trip.departureDateTime && `Saída ${fmtTime(trip.departureDateTime)}`}
                            {type === "event" && "Evento"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <TripDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) handleClose(); else setShowDialog(true); }}
        trip={selectedTrip}
      />
    </div>
  );
}
