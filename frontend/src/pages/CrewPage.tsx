import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crewsApi, Crew } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusPill } from "@/components/StatusPill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Trash2, Pencil, Users, FileSpreadsheet, Eye, Download,
  ShieldCheck, ShieldX, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { CrewCsvImport } from "@/components/CrewCsvImport";
import { format, parseISO, differenceInDays } from "date-fns";

const RANKS = ["", "PIC", "SIC", "FA", "FA1", "FOO"];
const STATUSES = ["", "valid", "warning", "expired"];

const PILOT_CERT_LABELS: Record<string, string> = {
  medex: "MEDEX",
  ppc: "PPC",
  loft: "LOFT",
  ground_training: "Ground Training",
  ielp: "IELP",
  crm: "CRM",
  ws: "WS",
  alar_cfit: "ALAR/CFIT",
  dg: "DG",
  cet: "CET",
  pbn: "PBN",
  avsec: "AVSEC",
  sms: "SMS",
};
const FA_CERT_LABELS: Record<string, string> = {
  cc: "CC",
  ground_training: "Ground Training",
  medex: "MEDEX",
  crm: "CRM",
  dg: "DG",
  cet: "CET",
  avsec: "AVSEC",
  sms: "SMS",
  first_aid: "First Aid",
};

function getCertLabels(rank: string) {
  return ["FA", "FA1"].includes(rank) ? FA_CERT_LABELS : PILOT_CERT_LABELS;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  // Sudah format YYYY-MM-DD → kembalikan as-is TANPA new Date() agar tidak timezone-shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // ISO timestamp (misal dari DB lama): ambil 10 karakter UTC pertama
  if (val.includes("T") || val.includes("Z")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return "";
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = toDateInput(val);
    if (!d) return "—";
    return format(parseISO(d), "d MMM yyyy");
  } catch { return val || "—"; }
}

function daysUntil(val: string | null | undefined): number | null {
  if (!val) return null;
  try {
    const d = toDateInput(val);
    if (!d) return null;
    return differenceInDays(parseISO(d), new Date());
  } catch { return null; }
}

// ── Download helper ──────────────────────────────────────────
function downloadCsv(filename: string, rows: string[][], headers: string[]) {
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrewPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Crew | null>(null);
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [detailCrew, setDetailCrew] = useState<Crew | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["crews", { search, rank, status }],
    queryFn: () => crewsApi.list({ search, rank, status_filter: status }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => crewsApi.remove(id),
    onSuccess: () => {
      toast.success("Crew dihapus");
      qc.invalidateQueries({ queryKey: ["crews"] });
      qc.invalidateQueries({ queryKey: ["crew-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const crews = data?.data ?? [];

  const handleDownloadAll = () => {
    const certKeys = ["medex", "ppc", "ground_training", "cet", "dg", "avsec", "ielp", "loft", "crm", "ws", "alar_cfit", "pbn", "sms", "cc", "first_aid"];
    const headers = ["Nama", "Employee ID", "Rank", "Status Medis", "Overall Status",
      ...certKeys.flatMap(k => [`${k.toUpperCase()} Conduct`, `${k.toUpperCase()} Valid`])
    ];
    const rows = crews.map(c => {
      const certCols = certKeys.flatMap(k => {
        const cert = (c.certs as any)?.[k];
        return [cert?.conduct ? formatDate(cert.conduct) : "—", cert?.valid ? formatDate(cert.valid) : "—"];
      });
      return [c.name, c.employee_id, c.rank, c.status || "—", c.overall_status, ...certCols];
    });
    downloadCsv(`crew-roster-${format(new Date(), "yyyy-MM-dd")}.csv`, rows, headers);
    toast.success("Download crew roster berhasil");
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-end gap-4 md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Crew Management
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Crew Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage all active flight personnel.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleDownloadAll} className="font-semibold">
              <Download className="h-4 w-4 mr-1.5" />
              Download CSV
            </Button>
            <Button variant="outline" onClick={() => setCsvOpen(true)} className="font-semibold">
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
            <Button
              onClick={() => { setEditing(null); setOpen(true); }}
              className="font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Crew
            </Button>
          </div>
        )}
      </div>

      <Card className="p-4 mt-5">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, employee ID, license..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={rank || "all"} onValueChange={(v) => setRank(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All ranks" /></SelectTrigger>
            <SelectContent>
              {RANKS.map((r) => (
                <SelectItem key={r || "all"} value={r || "all"}>{r || "All ranks"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s || "all"} value={s || "all"}>{s || "All status"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Crew</th>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Employee ID</th>
                <th className="px-4 py-3 font-semibold">Fit Status</th>
                <th className="px-4 py-3 font-semibold">Cert Status</th>
                {isAdmin && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && crews.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    Tidak ada crew ditemukan.
                  </td>
                </tr>
              )}
              {crews.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetailCrew(c)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold text-xs">
                        {c.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold">{c.name}</div>
                        {c.email && (
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{c.rank}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.employee_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === "unfit"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success-soft text-[hsl(var(--success))]"
                      }`}>
                      {c.status === "unfit"
                        ? <><ShieldX className="h-3 w-3" /> Unfit</>
                        : <><ShieldCheck className="h-3 w-3" /> Fit</>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={c.overall_status} /></td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => setDetailCrew(c)}
                        title="Lihat detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { setEditing(c); setOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => {
                          if (confirm(`Hapus ${c.name}?`)) removeMutation.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {isLoading && (
            <div className="py-6 text-center text-muted-foreground text-sm">Loading...</div>
          )}
          {!isLoading && crews.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Tidak ada crew.
            </div>
          )}
          {crews.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-3" onClick={() => setDetailCrew(c)}>
              <div className="h-10 w-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold">
                {c.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.rank} · {c.employee_id}</div>
                <div className="mt-1.5 flex gap-1.5">
                  <StatusPill status={c.overall_status} />
                  <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full ${c.status === "unfit" ? "bg-destructive/10 text-destructive" : "bg-success-soft text-[hsl(var(--success))]"
                    }`}>
                    {c.status === "unfit" ? "Unfit" : "Fit"}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => { setEditing(c); setOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => {
                      if (confirm(`Hapus ${c.name}?`)) removeMutation.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Detail Crew Dialog */}
      {detailCrew && (
        <CrewDetailDialog
          crew={detailCrew}
          open={!!detailCrew}
          onOpenChange={(v) => { if (!v) setDetailCrew(null); }}
          onEdit={(c) => { setEditing(c); setOpen(true); setDetailCrew(null); }}
          isAdmin={isAdmin}
        />
      )}

      {isAdmin && (
        <CrewFormDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          crew={editing}
        />
      )}

      {isAdmin && <CrewCsvImport open={csvOpen} onOpenChange={setCsvOpen} />}
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewDetailDialog — lihat detail cert, conduct, valid, dan hari tersisa
// ─────────────────────────────────────────────────────────────────────────────
function CrewDetailDialog({
  crew,
  open,
  onOpenChange,
  onEdit,
  isAdmin = false,
}: {
  crew: Crew;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (c: Crew) => void;
  isAdmin?: boolean;
}) {
  const certLabels = getCertLabels(crew.rank);

  const handleDownload = () => {
    const headers = ["Sertifikat", "Conduct", "Valid", "Status", "Sisa Hari"];
    const rows = Object.entries(certLabels).map(([field, label]) => {
      const cert = (crew.certs as any)?.[field];
      const days = daysUntil(cert?.valid);
      return [
        label,
        cert?.conduct ? formatDate(cert.conduct) : "—",
        cert?.valid ? formatDate(cert.valid) : "—",
        cert?.status || "—",
        days !== null ? (days < 0 ? `Expired ${Math.abs(days)} hari lalu` : `${days} hari lagi`) : "—",
      ];
    });
    downloadCsv(
      `${crew.name.replace(/\s+/g, "-")}-certificates.csv`,
      rows,
      headers
    );
    toast.success("Download sertifikat berhasil");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold">
              {crew.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
            </div>
            <div>
              <div>{crew.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {crew.rank} · {crew.employee_id}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <InfoBox label="Status Medis">
            <span className={`font-bold ${crew.status === "unfit" ? "text-destructive" : "text-[hsl(var(--success))]"}`}>
              {crew.status === "unfit" ? "Unfit" : "Fit"}
            </span>
          </InfoBox>
          <InfoBox label="Cert Status">
            <StatusPill status={crew.overall_status} />
          </InfoBox>
          <InfoBox label="License">{crew.license || "—"}</InfoBox>
          <InfoBox label="LOA">{crew.loa || "—"}</InfoBox>
        </div>

        {crew.phone && (
          <div className="text-xs text-muted-foreground">📞 {crew.phone}</div>
        )}

        {/* Basic Indoc (Pilot) */}
        {!["FA", "FA1"].includes(crew.rank) && (crew as any).basic_indoc_conduct && (
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Basic Indoc
            </div>
            <div className="text-sm font-semibold mt-0.5">
              Conduct: {formatDate((crew as any).basic_indoc_conduct)}
            </div>
          </div>
        )}

        {/* Cert table */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-sm uppercase tracking-wider">Sertifikat</h4>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Download
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(certLabels).map(([field, label]) => {
              const cert = (crew.certs as any)?.[field];
              const days = daysUntil(cert?.valid);
              const statusColor =
                cert?.status === "valid" ? "border-[hsl(var(--success))]/30 bg-success-soft/30"
                  : cert?.status === "warning" ? "border-[hsl(var(--warning))]/30 bg-warning-soft/30"
                    : "border-destructive/30 bg-destructive/5";

              return (
                <div key={field} className={`rounded-lg border p-3 ${statusColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${cert?.status === "valid" ? "bg-success-soft text-[hsl(var(--success))]"
                        : cert?.status === "warning" ? "bg-warning-soft text-[hsl(var(--warning))]"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                      {cert?.status || "N/A"}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Conduct: </span>
                      <span className="font-medium">{formatDate(cert?.conduct)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valid: </span>
                      <span className="font-medium">{formatDate(cert?.valid)}</span>
                    </div>
                  </div>
                  {days !== null && (
                    <div className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 ${days < 0 ? "text-destructive" : days <= 30 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]"
                      }`}>
                      <Calendar className="h-3 w-3" />
                      {days < 0
                        ? `Expired ${Math.abs(days)} hari lalu`
                        : `${days} hari lagi hingga expire`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          {isAdmin && (
            <Button onClick={() => onEdit(crew)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit Crew
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</div>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewFormDialog
// ─────────────────────────────────────────────────────────────────────────────
function CrewFormDialog({
  open,
  onOpenChange,
  crew,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crew: Crew | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!crew;

  function flattenCrew(c: Crew): any {
    const flat: any = { ...c };
    flat.basic_indoc_conduct = toDateInput(c.basic_indoc_conduct as any);

    if (c.certs) {
      for (const [field, val] of Object.entries(c.certs as any)) {
        flat[`${field}_conduct`] = toDateInput((val as any).conduct);
        flat[`${field}_valid`] = toDateInput((val as any).valid);
      }
    }
    return flat;
  }

  const [form, setForm] = useState<any>(() =>
    crew ? flattenCrew(crew) : { rank: "PIC", status: "fit" }
  );

  useMemo(() => {
    setForm(crew ? flattenCrew(crew) : { rank: "PIC", status: "fit" });
  }, [crew, open]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? crewsApi.update(crew!.id, data) : crewsApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? "Crew diperbarui" : "Crew ditambahkan");
      qc.invalidateQueries({ queryKey: ["crews"] });
      qc.invalidateQueries({ queryKey: ["crew-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const certLabels = getCertLabels(form.rank || "PIC");

  const END_OF_YEAR = ["sms", "dg", "alar_cfit", "pbn", "avsec", "crm", "first_aid"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Crew — ${crew?.name}` : "Tambah Crew Baru"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="space-y-4"
        >
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info Dasar</TabsTrigger>
              <TabsTrigger value="certs" className="flex-1">Sertifikat</TabsTrigger>
            </TabsList>

            {/* ── Tab Info Dasar ── */}
            <TabsContent value="info" className="space-y-3 mt-4">
              <Field label="Nama" required>
                <Input
                  value={form.name || ""}
                  onChange={(e) => setF("name", e.target.value)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employee ID" required>
                  <Input
                    value={form.employee_id || ""}
                    onChange={(e) => setF("employee_id", e.target.value)}
                    required
                    className="font-mono text-sm"
                  />
                </Field>
                <Field label="Rank" required>
                  <Select
                    value={form.rank || "PIC"}
                    onValueChange={(v) => setF("rank", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["PIC", "SIC", "FA", "FA1", "FOO"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="License">
                  <Input
                    value={form.license || ""}
                    onChange={(e) => setF("license", e.target.value)}
                  />
                </Field>
                <Field label="LOA">
                  <Input
                    value={form.loa || ""}
                    onChange={(e) => setF("loa", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => setF("email", e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone || ""}
                    onChange={(e) => setF("phone", e.target.value)}
                  />
                </Field>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                ℹ️ Status <strong>Fit/Unfit</strong> ditentukan otomatis dari tanggal MEDEX. Jika MEDEX sudah kadaluarsa → Unfit.
              </div>
              {/* Basic Indoc hanya untuk Pilot */}
              {form.rank !== "FA" && form.rank !== "FA1" && (
                <Field label="Basic Indoc (Tanggal Conduct)">
                  <Input
                    type="date"
                    value={form.basic_indoc_conduct || ""}
                    onChange={(e) => setF("basic_indoc_conduct", e.target.value)}
                  />
                </Field>
              )}
            </TabsContent>

            {/* ── Tab Sertifikat ── */}
            <TabsContent value="certs" className="mt-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300 mb-3">
                ⚠️ Sertifikat <strong>SMS, DG, ALAR/CFIT, PBN, AVSEC, CRM, First Aid</strong> — tanggal Valid otomatis dihitung ke <strong>31 Desember</strong> tahun conduct.
                <br />Isi tanggal <strong>Conduct</strong>. Tanggal <strong>Valid</strong> akan dihitung otomatis jika dikosongkan.
              </div>
              <div className="grid gap-3">
                {Object.entries(certLabels).map(([field, label]) => (
                  <div key={field} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wider">
                        {label}
                      </div>
                      {END_OF_YEAR.includes(field) && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">31 Des</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Conduct">
                        <Input
                          type="date"
                          value={form[`${field}_conduct`] || ""}
                          onChange={(e) => setF(`${field}_conduct`, e.target.value)}
                        />
                      </Field>
                      <Field label="Valid (opsional)">
                        <Input
                          type="date"
                          value={form[`${field}_valid`] || ""}
                          onChange={(e) => setF(`${field}_valid`, e.target.value)}
                          placeholder="Auto-calc"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Tambah Crew"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wider font-semibold">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}