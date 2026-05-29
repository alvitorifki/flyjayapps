import { useQuery } from "@tanstack/react-query";
import { crewsApi, schedulesApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusPill } from "@/components/StatusPill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Users, Plane, ShieldAlert, CalendarCheck2, ArrowRight, AlertTriangle, CheckCircle2,
  Clock, GraduationCap, Coffee,
} from "lucide-react";
import heroSky from "@/assets/hero-sky.jpg";
import { format, parseISO } from "date-fns";

const TYPE_ICON: Record<string, any> = {
  flight: Plane,
  training: GraduationCap,
  off: Coffee,
  standby: Clock,
};
const TYPE_COLOR: Record<string, string> = {
  flight: "bg-primary-soft text-primary",
  training: "bg-warning-soft text-[hsl(var(--warning))]",
  off: "bg-muted text-muted-foreground",
  standby: "bg-success-soft text-[hsl(var(--success))]",
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const stats = useQuery({
    queryKey: ["crew-stats"],
    queryFn: () => crewsApi.stats(),
    enabled: isAdmin,
  });

  const alerts = useQuery({
    queryKey: ["crew-alerts"],
    queryFn: () => crewsApi.alerts(),
    enabled: isAdmin,
  });

  const now = new Date();
  const schedules = useQuery({
    queryKey: ["schedules", now.getFullYear(), now.getMonth() + 1],
    queryFn: () => schedulesApi.list({ year: now.getFullYear(), month: now.getMonth() + 1 }),
  });

  const myCrew = useQuery({
    queryKey: ["crew-me"],
    queryFn: () => crewsApi.me(),
    enabled: !isAdmin && !!user?.crew_id,
  });

  const totalCrew   = stats.data?.total ?? 0;
  const expiredCount = stats.data?.expired ?? 0;
  const warnCount   = stats.data?.warning ?? 0;
  const validCount  = stats.data?.valid ?? 0;
  const activeFlights = schedules.data?.data.filter((s) => s.type === "flight").length ?? 0;

  // For crew: my schedules this month
  const mySchedules = schedules.data?.data ?? [];

  return (
    <AppLayout>
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-2xl shadow-elevated">
        <img src={heroSky} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/85 via-primary/55 to-transparent" />
        <div className="relative p-6 md:p-10 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-90">
            {isAdmin ? "Admin Console" : "Crew Portal"}
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold">
            Selamat datang, {user?.name?.split(" ")[0] || "Crew"}.
          </h1>
          <p className="mt-2 max-w-xl text-white/90">
            {isAdmin
              ? `${activeFlights} penerbangan terjadwal bulan ini · ${expiredCount + warnCount} sertifikat perlu perhatian.`
              : `Pantau sertifikat dan jadwal tugas Anda · ${mySchedules.length} kegiatan bulan ini.`}
          </p>
          {!isAdmin && user?.rank && user?.employee_id && (
            <div className="mt-2 text-sm text-white/75">
              {user.rank} · {user.employee_id}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="font-semibold">
              <Link to="/schedule"><Plane className="h-4 w-4 mr-2" />Lihat Jadwal</Link>
            </Button>
            <Button asChild variant="ghost" className="text-white hover:bg-white/15 hover:text-white font-semibold">
              <Link to="/certificates">Review Sertifikat <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Admin stat cards */}
      {isAdmin && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Crew"    value={totalCrew}                         icon={Users}          tint="primary"      sub={`${stats.data?.by_rank ? Object.keys(stats.data.by_rank).length : 0} rank`} />
          <StatCard label="Penerbangan"   value={activeFlights}                     icon={CalendarCheck2} tint="success"     sub="Bulan ini" />
          <StatCard label="Warning Cert"  value={warnCount}                         icon={Clock}          tint="warning"     sub="< 90 hari" />
          <StatCard label="Expired Cert"  value={expiredCount}                      icon={ShieldAlert}    tint="destructive" sub="Tindakan diperlukan" />
        </div>
      )}

      {/* Crew stat cards */}
      {!isAdmin && myCrew.data && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 col-span-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Profil Saya</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full gradient-hero text-white flex items-center justify-center font-bold text-lg">
                {myCrew.data.data.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
              </div>
              <div>
                <div className="font-bold text-lg">{myCrew.data.data.name}</div>
                <div className="text-sm text-muted-foreground">
                  {myCrew.data.data.rank} · {myCrew.data.data.employee_id}
                </div>
                {myCrew.data.data.license && (
                  <div className="text-xs text-muted-foreground">License: {myCrew.data.data.license}</div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <StatusPill status={myCrew.data.data.overall_status} />
              {myCrew.data.data.status && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  myCrew.data.data.status === "fit"
                    ? "bg-success-soft text-[hsl(var(--success))]"
                    : "bg-destructive-soft text-destructive"
                }`}>
                  <CheckCircle2 className="h-3 w-3" />
                  {myCrew.data.data.status === "fit" ? "Fit to Fly" : "Unfit"}
                </span>
              )}
            </div>
          </Card>
          <StatCard label="Kegiatan Bulan Ini" value={mySchedules.length}             icon={CalendarCheck2} tint="primary"  sub={format(now, "MMMM yyyy")} />
          <StatCard label="Status Cert"         value={myCrew.data.data.overall_status.toUpperCase()} icon={ShieldAlert}    tint={myCrew.data.data.overall_status === "valid" ? "success" : myCrew.data.data.overall_status === "warning" ? "warning" : "destructive"} />
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        {/* Alerts / My schedule */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAdmin
                ? <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                : <CalendarCheck2 className="h-4 w-4 text-primary" />
              }
              <h2 className="font-bold text-lg">
                {isAdmin ? "Urgent Alerts" : "Jadwal Saya Bulan Ini"}
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={isAdmin ? "/certificates" : "/schedule"}>
                Lihat semua <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-3 divide-y divide-border">
            {/* Admin: cert alerts */}
            {isAdmin && alerts.isLoading && <SkeletonRows />}
            {isAdmin && alerts.data?.data.slice(0, 6).map((a) => (
              <div key={`${a.id}-${a.cert_name}`} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold text-xs">
                  {a.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.cert_name} · {a.rank} · {a.employee_id}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${a.days_remaining < 0 ? "text-destructive" : "text-[hsl(var(--warning))]"}`}>
                    {a.valid_date ? format(parseISO(String(a.valid_date).substring(0, 10)), "dd MMM yyyy") : "-"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.days_remaining < 0
                      ? `${Math.abs(a.days_remaining)} hari overdue`
                      : `${a.days_remaining} hari lagi`}
                  </div>
                </div>
              </div>
            ))}
            {isAdmin && alerts.data?.data.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Tidak ada alert aktif. 🎉</div>
            )}

            {/* Crew: my schedules */}
            {!isAdmin && schedules.isLoading && <SkeletonRows />}
            {!isAdmin && mySchedules.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Belum ada jadwal bulan ini.
              </div>
            )}
            {!isAdmin && mySchedules.slice(0, 6).map((s) => {
              const Icon = TYPE_ICON[s.type] || Plane;
              const color = TYPE_COLOR[s.type] || TYPE_COLOR.standby;
              return (
                <div key={s.id} className="py-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {s.activity || s.type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(s.date_start), "EEE, d MMM yyyy")}
                      {s.date_end ? ` → ${format(parseISO(s.date_end), "d MMM")}` : ""}
                      {s.detail ? ` · ${s.detail}` : ""}
                    </div>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${color}`}>
                    {s.type}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick ops + compliance */}
        <div className="space-y-4">
          <Card className="p-5 gradient-hero text-white">
            <div className="text-xs uppercase tracking-wider opacity-90 font-semibold">Quick Operations</div>
            <h3 className="font-bold text-lg mt-1">Flight Schedule</h3>
            <p className="text-sm opacity-90 mt-1">
              {isAdmin ? "Manage routes & crew assignments." : "Lihat jadwal penerbangan & training."}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link to="/schedule">Open Schedule <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </Card>

          {isAdmin && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Compliance</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Mini value={validCount}   label="Valid"   tint="success" />
                <Mini value={warnCount}    label="Warning" tint="warning" />
                <Mini value={expiredCount} label="Expired" tint="destructive" />
              </div>
              <Button asChild size="sm" variant="outline" className="w-full mt-3">
                <Link to="/certificates">Review compliance</Link>
              </Button>
            </Card>
          )}

          {!isAdmin && myCrew.data && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cert Status</div>
              <div className="mt-2">
                <StatusPill status={myCrew.data.data.overall_status} />
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {Object.values(myCrew.data.data.certs ?? {}).filter((c: any) => c.status === "warning").length} sertifikat mendekati kadaluarsa.
              </div>
              <Button asChild size="sm" variant="outline" className="w-full mt-3">
                <Link to="/certificates">Lihat sertifikat</Link>
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Bulan Ini</div>
            <div className="mt-2 text-3xl font-extrabold">
              {schedules.data?.data.length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              kegiatan di {format(now, "MMMM yyyy")}
            </div>
          </Card>

          {isAdmin && stats.data?.by_rank && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Komposisi Crew</div>
              {Object.entries(stats.data.by_rank).map(([rank, count]) => (
                <div key={rank} className="flex items-center justify-between py-1">
                  <span className="text-sm font-semibold">{rank}</span>
                  <span className="text-sm text-muted-foreground">{count} crew</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, tint, sub }: any) {
  const tintMap: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-[hsl(var(--success))]",
    warning: "bg-warning-soft text-[hsl(var(--warning))]",
    destructive: "bg-destructive-soft text-destructive",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tintMap[tint]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Mini({ value, label, tint }: { value: number; label: string; tint: string }) {
  const tintMap: Record<string, string> = {
    success: "text-[hsl(var(--success))]",
    warning: "text-[hsl(var(--warning))]",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-lg bg-muted/50 py-2">
      <div className={`text-xl font-extrabold ${tintMap[tint]}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 py-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-2 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}