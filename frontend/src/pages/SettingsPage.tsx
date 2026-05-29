import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { authApi, crewsApi, DEFAULT_BASE_URL, getBaseUrl, setBaseUrl, healthApi } from "@/lib/api";
import { toast } from "sonner";
import { Server, KeyRound, User2, CheckCircle2, XCircle, Loader2, UserPlus, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [base, setBase] = useState(getBaseUrl());
  const [pwForm, setPw] = useState({ current: "", next: "", confirm: "" });
  const [checking, setChecking] = useState(false);
  const [healthOk, setHealthOk] = useState<null | boolean>(null);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Admin register form
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [registerLoading, setRegisterLoading] = useState(false);

  const saveBaseUrl = () => {
    setBaseUrl(base);
    toast.success("API base URL tersimpan");
  };

  const checkHealth = async () => {
    setChecking(true);
    setHealthOk(null);
    try {
      await healthApi.check();
      setHealthOk(true);
      toast.success("API server terhubung ✓");
    } catch (e: any) {
      setHealthOk(false);
      toast.error(e.message || "Gagal menghubungi API");
    } finally {
      setChecking(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    if (pwForm.next.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    setSaving(true);
    try {
      await crewsApi.changePassword(pwForm.current, pwForm.next);
      toast.success("Password berhasil diubah");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const registerAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminForm.password.length < 8) {
      toast.error("Password admin minimal 8 karakter");
      return;
    }
    setRegisterLoading(true);
    try {
      await authApi.registerAdmin(adminForm);
      toast.success(`Admin "${adminForm.name}" berhasil didaftarkan`);
      setAdminForm({ name: "", email: "", password: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <AppLayout>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Settings</div>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Account & API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update credentials dan konfigurasi koneksi API.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-5">
        {/* Profile card */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <User2 className="h-4 w-4 text-primary" />
            <h3 className="font-bold">Profile</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full gradient-hero text-white flex items-center justify-center font-bold text-lg">
              {user?.name?.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
            </div>
            <div>
              <div className="font-bold">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
              {user?.employee_id && (
                <div className="text-xs font-mono text-muted-foreground">{user.employee_id}</div>
              )}
              <div className="mt-1 inline-flex gap-1">
                <span className="text-xs uppercase tracking-wider bg-primary-soft text-primary px-2 py-0.5 rounded-full font-semibold">
                  {user?.role}
                </span>
                {user?.rank && (
                  <span className="text-xs uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                    {user.rank}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* API Config */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="font-bold">API Configuration</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Base URL endpoint backend FlyJaya. Default: <span className="font-mono">{DEFAULT_BASE_URL}</span>
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              className="font-mono text-sm"
            />
            <Button onClick={saveBaseUrl}>Simpan</Button>
            <Button variant="outline" onClick={checkHealth} disabled={checking}>
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : healthOk === true ? (
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
              ) : healthOk === false ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : null}
              <span className="ml-1.5">Test</span>
            </Button>
          </div>
          {healthOk === true && (
            <p className="text-xs text-[hsl(var(--success))] mt-1">✓ Server terhubung dan berjalan normal</p>
          )}
          {healthOk === false && (
            <p className="text-xs text-destructive mt-1">✗ Tidak dapat menghubungi server. Periksa URL dan pastikan backend berjalan.</p>
          )}
        </Card>

        {/* Change Password — for crew who have crew_id */}
        {user?.crew_id && (
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="font-bold">Ganti Password</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Password default Anda adalah Employee ID. Segera ganti untuk keamanan akun.
            </p>
            <form onSubmit={changePw} className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Password Lama</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={pwForm.current}
                    onChange={(e) => setPw({ ...pwForm, current: e.target.value })}
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Password Baru</Label>
                <Input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPw({ ...pwForm, next: e.target.value })}
                  required
                  placeholder="Min. 6 karakter"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Konfirmasi</Label>
                <Input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPw({ ...pwForm, confirm: e.target.value })}
                  required
                  placeholder="Ulangi password baru"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Update Password"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Admin: Register new admin */}
        {isAdmin && (
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-primary" />
              <h3 className="font-bold">Daftarkan Admin Baru</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Buat akun admin baru untuk akses panel manajemen.
            </p>
            <form onSubmit={registerAdmin} className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Nama Lengkap *</Label>
                <Input
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  placeholder="Nama admin"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Email *</Label>
                <Input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@flyjaya.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider font-semibold">Password * (min. 8)</Label>
                <Input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder="Min. 8 karakter"
                  required
                  minLength={8}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={registerLoading} variant="secondary">
                  {registerLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mendaftarkan...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" />Daftarkan Admin</>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
