import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Loader2, Settings2, ShieldCheck, UserRound, IdCard } from "lucide-react";
import { toast } from "sonner";
import heroSky from "@/assets/hero-sky.jpg";
import { DEFAULT_BASE_URL, getBaseUrl, setBaseUrl } from "@/lib/api";

type LoginMode = "admin" | "crew";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<LoginMode>("admin");
  const [email, setEmail] = useState("admin@flyjaya.com");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [baseUrl, setBaseUrlInput] = useState(getBaseUrl());

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setEmail(m === "admin" ? "admin@flyjaya.com" : "");
    setPassword("");
    setEmployeeId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "crew") {
        // Crew login: email dari crews table, password = employee_id
        await login(email, employeeId);
      } else {
        await login(email, password);
      }
      toast.success("Login berhasil");
      const from = (location.state as any)?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login gagal. Periksa kredensial Anda.");
    } finally {
      setLoading(false);
    }
  };

  const saveBase = () => {
    setBaseUrl(baseUrl);
    toast.success("API base URL tersimpan");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel - hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <img src={heroSky} alt="Sky" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-foreground/60" />
        <div className="relative flex items-center gap-3">
          <img src="/logo-header-flyjaya.svg" alt="FlyJaya" className="h-10 brightness-0 invert" />
        </div>
        <div className="relative space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">
            Flight Operations Management
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
            Elevate Flight<br />Operations Control
          </h1>
          <p className="max-w-md text-white/85 leading-relaxed">
            Secure access to the FlyJaya administrative ecosystem for crew management, scheduling, and operational excellence.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Fleet</div>
              <div className="font-bold text-sm">ATR 72-500</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Auth</div>
              <div className="font-bold text-sm">JWT 8h</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-1">System</div>
              <div className="font-bold text-sm">Online</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img src="/logo-header-flyjaya.svg" alt="FlyJaya" className="h-10" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card">
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-muted p-1 mb-6 gap-1">
              {(["admin", "crew"] as LoginMode[]).map((m) => {
                const Icon = m === "admin" ? ShieldCheck : UserRound;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 ${
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {m === "admin" ? "Admin" : "Crew"}
                  </button>
                );
              })}
            </div>

            <h2 className="text-2xl font-bold">
              {mode === "admin" ? "Admin Login" : "Crew Login"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "admin"
                ? "Akses panel manajemen crew, sertifikat & jadwal."
                : "Gunakan email dan Employee ID Anda untuk masuk."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    placeholder={mode === "admin" ? "admin@flyjaya.com" : "nama@flyjaya.com"}
                    required
                  />
                </div>
              </div>

              {/* Admin: password field */}
              {mode === "admin" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wider font-semibold">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-11"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Crew: employee_id as password */}
              {mode === "crew" && (
                <div className="space-y-1.5">
                  <Label htmlFor="employee_id" className="text-xs uppercase tracking-wider font-semibold">
                    Employee ID <span className="text-muted-foreground font-normal normal-case">(digunakan sebagai password)</span>
                  </Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="employee_id"
                      type="password"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="pl-9 h-11 font-mono"
                      placeholder="SMN.2025.1.048"
                      required
                    />
                  </div>
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
                    <div className="font-semibold text-primary text-xs">Cara Login Crew</div>
                    <div>• Email: email yang terdaftar di data crew</div>
                    <div>• Employee ID: contoh <span className="font-mono font-semibold text-foreground">SMN.2025.1.048</span></div>
                    <div>• Password bisa diubah di menu Settings setelah login</div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "admin" ? (
                  "Masuk sebagai Admin →"
                ) : (
                  "Masuk sebagai Crew →"
                )}
              </Button>
            </form>

            {/* API config */}
            <div className="mt-6 pt-5 border-t border-border">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {showSettings ? "Sembunyikan" : "Konfigurasi"} API Base URL
              </button>
              {showSettings && (
                <div className="mt-3 space-y-2">
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder={DEFAULT_BASE_URL}
                    className="text-xs font-mono"
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={saveBase}>
                      Simpan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBaseUrlInput(DEFAULT_BASE_URL);
                        setBaseUrl(DEFAULT_BASE_URL);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Default: {DEFAULT_BASE_URL}</p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Authorized personnel only. All access is logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
