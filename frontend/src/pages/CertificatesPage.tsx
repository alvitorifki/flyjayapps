import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crewsApi, schedulesApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, ShieldX, Search,
  CalendarCheck2, Download, FileSpreadsheet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

// ── Format tanggal dari DB (bisa berupa YYYY-MM-DD atau ISO timestamp) ──────
// Menghindari tampilan "2026-04-29T17:00:00.000Z" di UI
function formatDbDate(val: string | null | undefined): string {
  if (!val) return "—";
  // Ambil 10 karakter pertama saja → "YYYY-MM-DD", abaikan timezone
  const dateOnly = String(val).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return val;
  try {
    const [yyyy, mm, dd] = dateOnly.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${parseInt(dd)} ${months[parseInt(mm) - 1]} ${yyyy}`;
  } catch { return dateOnly; }
}

const CERT_LABEL_MAP: Record<string, string> = {
  ppc: "PPC",
  ground_training: "Ground Training",
  loft: "LOFT",
  medex: "MEDEX",
  ielp: "IELP",
  crm: "CRM",
  ws: "WS",
  alar_cfit: "ALAR/CFIT",
  dg: "DG",
  cet: "CET",
  pbn: "PBN",
  avsec: "AVSEC",
  sms: "SMS",
  tcas: "TCAS",
  cc: "CC",
  first_aid: "First Aid",
};

// ── Download CSV helper ──────────────────────────────────────
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

// ── Simple PDF generator via browser print ───────────────────
function downloadPdf(title: string, headers: string[], rows: string[][]) {
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td>${cell || "—"}</td>`).join("")}</tr>`
  ).join("");

  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
      h2 { color: #1e40af; margin-bottom: 4px; }
      .meta { color: #666; margin-bottom: 16px; font-size: 10px; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { border: 1px solid #ddd; padding: 5px 8px; }
      tr:nth-child(even) { background: #f5f5f5; }
      @media print { body { padding: 10px; } }
    </style>
    </head><body>
    <h2>${title}</h2>
    <div class="meta">Generated: ${format(new Date(), "d MMMM yyyy HH:mm")} | FlyJaya</div>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>
  `;

  const printWin = window.open("", "_blank", "width=900,height=700");
  if (!printWin) { toast.error("Popup diblokir browser. Izinkan popup lalu coba lagi."); return; }
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 500);
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [daysFilter, setDaysFilter] = useState("90");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityInput, setActivityInput] = useState("");

  const stats = useQuery({ queryKey: ["crew-stats"], queryFn: () => crewsApi.stats(), enabled: isAdmin });
  const alerts = useQuery({
    queryKey: ["crew-alerts", daysFilter],
    queryFn: () => crewsApi.alerts(parseInt(daysFilter) || 90),
    enabled: isAdmin,
  });
  const me = useQuery({ queryKey: ["crew-me"], queryFn: () => crewsApi.me(), enabled: !isAdmin });
  const schema = useQuery({ queryKey: ["training-schema"], queryFn: () => crewsApi.trainingSchema() });

  const now = new Date();
  const activityResult = useQuery({
    queryKey: ["schedule-by-activity", activityQuery, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => schedulesApi.byActivity(activityQuery, now.getFullYear(), now.getMonth() + 1),
    enabled: isAdmin && activityQuery.length > 0,
  });

  const items = alerts.data?.data ?? [];
  const filteredItems = search
    ? items.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (CERT_LABEL_MAP[a.cert_name] || a.cert_name).toLowerCase().includes(search.toLowerCase()) ||
        a.rank.toLowerCase().includes(search.toLowerCase()) ||
        a.employee_id.toLowerCase().includes(search.toLowerCase())
    )
    : items;

  const critical = filteredItems.filter((a) => a.days_remaining < 30);
  const warning = filteredItems.filter((a) => a.days_remaining >= 30 && a.days_remaining < 90);

  const myCerts = me.data?.data?.certs ?? {};
  const myRank = me.data?.data?.rank ?? "";
  const relevantKeys = ["FA", "FA1"].includes(myRank)
    ? ["cc", "ground_training", "medex", "crm", "dg", "cet", "avsec", "sms", "first_aid"]
    : ["ppc", "ground_training", "loft", "medex", "ielp", "crm", "ws", "alar_cfit", "dg", "cet", "pbn", "avsec", "sms"];

  // ── Download expiring certs ──────────────────────────────
  const handleDownloadExpiring = (format_type: "csv" | "pdf") => {
    const threshold = parseInt(daysFilter) || 90;
    const target = threshold <= 30 ? filteredItems : filteredItems.filter(a => a.days_remaining <= 30);
    const headers = ["Nama", "Employee ID", "Rank", "Sertifikat", "Tanggal Valid", "Sisa Hari", "Status"];
    const rows = target.map(a => [
      a.name,
      a.employee_id,
      a.rank,
      CERT_LABEL_MAP[a.cert_name] || a.cert_name,
      formatDbDate(a.valid_date),
      a.days_remaining < 0
        ? `Expired ${Math.abs(a.days_remaining)} hari lalu`
        : `${a.days_remaining} hari lagi`,
      a.days_remaining < 0 ? "EXPIRED" : a.days_remaining < 30 ? "CRITICAL" : "WARNING",
    ]);

    const title = `Sertifikat Mendekati Expired — ${threshold} Hari`;
    if (format_type === "csv") {
      downloadCsv(`expiring-certs-${threshold}days-${format(new Date(), "yyyy-MM-dd")}.csv`, rows, headers);
      toast.success("Download CSV berhasil");
    } else {
      downloadPdf(title, headers, rows);
    }
  };

  const handleDownloadAllAlerts = (format_type: "csv" | "pdf") => {
    const headers = ["Nama", "Employee ID", "Rank", "Sertifikat", "Tanggal Valid", "Sisa Hari"];
    const rows = filteredItems.map(a => [
      a.name,
      a.employee_id,
      a.rank,
      CERT_LABEL_MAP[a.cert_name] || a.cert_name,
      formatDbDate(a.valid_date),
      a.days_remaining < 0
        ? `Expired ${Math.abs(a.days_remaining)} hari lalu`
        : `${a.days_remaining} hari lagi`,
    ]);
    const title = `Compliance Report — ${parseInt(daysFilter)} Hari`;
    if (format_type === "csv") {
      downloadCsv(`compliance-report-${format(new Date(), "yyyy-MM-dd")}.csv`, rows, headers);
      toast.success("Download CSV berhasil");
    } else {
      downloadPdf(title, headers, rows);
    }
  };

  return (
    <AppLayout>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Certificate Alerts
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-1">
          {isAdmin ? "Compliance Overview" : "My Certifications"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Review and manage crew certification expiries."
            : "Pantau status sertifikasi Anda dan jadwal renewal."}
        </p>
      </div>

      {/* ── Admin: stats summary ── */}
      {isAdmin && (
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Crew" value={stats.data?.total ?? 0} icon={ShieldCheck} tint="primary" />
          <SummaryCard label="Valid" value={stats.data?.valid ?? 0} icon={ShieldCheck} tint="success" />
          <SummaryCard label="Warning" value={stats.data?.warning ?? 0} icon={AlertTriangle} tint="warning" />
          <SummaryCard label="Expired" value={stats.data?.expired ?? 0} icon={ShieldX} tint="destructive" />
        </div>
      )}

      {/* ── Admin: filter + search + download ── */}
      {isAdmin && (
        <div className="mt-5 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, cert, rank..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter hari" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">≤ 30 hari</SelectItem>
              <SelectItem value="60">≤ 60 hari</SelectItem>
              <SelectItem value="90">≤ 90 hari</SelectItem>
              <SelectItem value="180">≤ 180 hari</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => handleDownloadAllAlerts("csv")} className="font-semibold">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownloadAllAlerts("pdf")} className="font-semibold">
              <Download className="h-3.5 w-3.5 mr-1.5" />PDF
            </Button>
          </div>
        </div>
      )}

      {/* ── 30-day expiring download card ── */}
      {isAdmin && (
        <Card className="mt-4 p-4 border-l-4 border-l-[hsl(var(--warning))] bg-warning-soft/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                Download Sertifikat Mendekati Expired (30 Hari)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Unduh daftar crew yang sertifikatnya akan expired dalam 30 hari ke depan.
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => handleDownloadExpiring("csv")}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadExpiring("pdf")}>
                <Download className="h-3.5 w-3.5 mr-1.5" />PDF
              </Button>
            </div>
          </div>
          <div className="mt-2 text-sm font-semibold text-[hsl(var(--warning))]">
            {filteredItems.filter(a => a.days_remaining <= 30 && a.days_remaining >= 0).length} sertifikat
            &nbsp;·&nbsp;
            {filteredItems.filter(a => a.days_remaining < 0).length} sudah expired
          </div>
        </Card>
      )}

      {/* ── Admin: cert alerts ── */}
      {isAdmin && (
        <>
          <Section
            title="Critical (< 30 hari)"
            tint="destructive"
            items={critical}
            empty="Tidak ada sertifikat kritis."
          />
          <Section
            title={`Warning (30–90 hari)`}
            tint="warning"
            items={warning}
            empty="Tidak ada sertifikat warning."
          />
        </>
      )}

      {/* ── Admin: activity search ── */}
      {isAdmin && (
        <Card className="p-5 mt-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-primary" />
            Cari Crew per Aktivitas Training
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Lihat siapa saja yang mengikuti training tertentu bulan ini.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Nama aktivitas (contoh: DG, CRM, AVSEC...)"
              value={activityInput}
              onChange={(e) => setActivityInput(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && setActivityQuery(activityInput)}
            />
            <Button onClick={() => setActivityQuery(activityInput)} variant="secondary">
              Cari
            </Button>
            {activityQuery && (
              <Button variant="ghost" onClick={() => { setActivityQuery(""); setActivityInput(""); }}>
                Reset
              </Button>
            )}
          </div>
          {activityResult.isLoading && (
            <p className="text-sm text-muted-foreground mt-3">Loading...</p>
          )}
          {activityResult.data && (
            <div className="mt-3 divide-y divide-border">
              <div className="pb-2 text-xs text-muted-foreground font-semibold uppercase">
                Hasil: {activityResult.data.data.length} crew — "{activityResult.data.activity}"
              </div>
              {activityResult.data.data.length === 0 && (
                <div className="py-4 text-sm text-muted-foreground">Tidak ada data untuk aktivitas ini bulan ini.</div>
              )}
              {activityResult.data.data.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold text-xs">
                    {item.crew_name?.split(" ").slice(0, 2).map((s: string) => s[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{item.crew_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.crew_role} · {item.rank || ""} · {item.employee_id || ""}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {item.date_start ? format(parseISO(item.date_start), "d MMM yyyy") : ""}
                    {item.date_end ? ` → ${format(parseISO(item.date_end), "d MMM")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Crew: my certifications ── */}
      {!isAdmin && me.data && (
        <Card className="p-5 mt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full gradient-hero text-white flex items-center justify-center font-bold text-lg">
              {me.data.data.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
            </div>
            <div>
              <div className="font-bold text-lg">{me.data.data.name}</div>
              <div className="text-sm text-muted-foreground">
                {me.data.data.rank} · {me.data.data.employee_id}
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${me.data.data.status === "unfit" ? "text-destructive" : "text-[hsl(var(--success))]"}`}>
                {me.data.data.status === "unfit" ? "⚠ Unfit (MEDEX expired)" : "✓ Fit"}
              </div>
            </div>
          </div>

          {!["FA", "FA1"].includes(myRank) && (me.data.data as any).basic_indoc_conduct && (
            <div className="mb-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Basic Indoc</div>
              <div className="text-sm font-semibold mt-0.5">
                Conduct: {format(parseISO((me.data.data as any).basic_indoc_conduct), "d MMM yyyy")}
              </div>
            </div>
          )}

          <h3 className="font-bold mb-3">Sertifikasi Aktif</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {relevantKeys.map((key) => {
              const value = myCerts[key] as any;
              if (!value) return null;
              return (
                <div key={key} className="rounded-lg border border-border p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {CERT_LABEL_MAP[key] || key}
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    Valid: {value.valid ? format(parseISO(value.valid), "d MMM yyyy") : "—"}
                  </div>
                  {value.conduct && (
                    <div className="text-xs text-muted-foreground">
                      Conduct: {format(parseISO(value.conduct), "d MMM yyyy")}
                    </div>
                  )}
                  <div className="mt-2">
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${value.status === "valid"
                          ? "bg-success-soft text-[hsl(var(--success))]"
                          : value.status === "warning"
                            ? "bg-warning-soft text-[hsl(var(--warning))]"
                            : "bg-destructive-soft text-destructive"
                        }`}
                    >
                      {value.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Training schema */}
      {schema.data && (
        <Card className="p-5 mt-5">
          <h3 className="font-bold text-lg">Training Schema</h3>
          <p className="text-sm text-muted-foreground">Durasi validitas per training.</p>
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            <SchemaList
              title="Pilot (PIC/SIC/FOO)"
              items={schema.data.pilot}
              endOfYearCerts={schema.data.end_of_year_certs || []}
            />
            <SchemaList
              title="Flight Attendant (FA/FA1)"
              items={schema.data.fa}
              endOfYearCerts={schema.data.end_of_year_certs || []}
            />
          </div>
        </Card>
      )}
    </AppLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, tint }: any) {
  const tintMap: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-[hsl(var(--success))]",
    warning: "bg-warning-soft text-[hsl(var(--warning))]",
    destructive: "bg-destructive-soft text-destructive",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tintMap[tint]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-2xl font-extrabold">{value}</div>
      </div>
    </Card>
  );
}

function Section({
  title, tint, items, empty,
}: {
  title: string;
  tint: "destructive" | "warning";
  items: any[];
  empty: string;
}) {
  const accent = tint === "destructive" ? "border-l-destructive" : "border-l-[hsl(var(--warning))]";
  return (
    <Card className={`mt-5 p-5 border-l-4 ${accent}`}>
      <div className="flex items-center gap-2">
        <ShieldAlert className={`h-4 w-4 ${tint === "destructive" ? "text-destructive" : "text-[hsl(var(--warning))]"}`} />
        <h3 className="font-bold text-lg">{title}</h3>
        <span className="ml-auto text-sm font-bold">{items.length}</span>
      </div>
      <div className="mt-3 divide-y divide-border">
        {items.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">{empty}</div>
        )}
        {items.map((a, idx) => (
          <div key={`${a.id}-${a.cert_name}-${idx}`} className="py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted text-foreground flex items-center justify-center font-semibold text-xs shrink-0">
              {a.name.split(" ").slice(0, 2).map((s: string) => s[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.name}</div>
              <div className="text-xs text-muted-foreground">
                {CERT_LABEL_MAP[a.cert_name] || a.cert_name} · {a.rank} · {a.employee_id}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-bold ${a.days_remaining < 0 ? "text-destructive" : "text-[hsl(var(--warning))]"}`}>
                {formatDbDate(a.valid_date)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {a.days_remaining < 0
                  ? `${Math.abs(a.days_remaining)} hari expired`
                  : `${a.days_remaining} hari lagi`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SchemaList({
  title,
  items,
  endOfYearCerts,
}: {
  title: string;
  items: { field: string; months: number }[];
  endOfYearCerts: string[];
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <div key={it.field} className="text-xs flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
            <span className="font-medium uppercase">{CERT_LABEL_MAP[it.field] || it.field}</span>
            <span className="text-muted-foreground">
              {endOfYearCerts.includes(it.field) ? "31 Des" : `${it.months}m`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}