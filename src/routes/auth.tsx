import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lookupEmailByUsername } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Portal — Mechatron Robotik School" },
      { name: "description", content: "Portal absensi pengajar Mechatron Robotik School." },
    ],
  }),
  component: AuthPage,
});

const REMEMBER_KEY = "auth:remember";

function AuthPage() {
  const navigate = useNavigate();
  const lookup = useServerFn(lookupEmailByUsername);

  // Mode Tampilan: Mau Login atau Daftar?
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);

  // --- STATE KHUSUS LOGIN ---
  const [emailOrName, setEmailOrName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(true);

  // --- STATE KHUSUS DAFTAR ---
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    try {
      const v = localStorage.getItem(REMEMBER_KEY);
      if (v !== null) setRemember(v === "1");
    } catch {}
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  // ==========================================
  // LOGIKA LOGIN
  // ==========================================
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let email = emailOrName.trim();

    if (!email.includes("@")) {
      try {
        const res = await lookup({ data: { username: email } });
        if (!res || !res.email) {
          throw new Error("Username tidak ditemukan");
        }
        email = res.email;
      } catch (err) {
        setLoading(false);
        toast.error("Gagal masuk", { 
          description: err instanceof Error ? err.message : "Terjadi kesalahan" 
        });
        return;
      }
    }

    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, "1");
      } else {
        localStorage.setItem(REMEMBER_KEY, "0");
      }

      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password: loginPassword 
      });

      if (error) throw error;

      toast.success("Login Berhasil!", { duration: 2000 });
      setTimeout(() => {
        navigate({ to: "/", replace: true });
      }, 2000);

    } catch (err: any) {
      setLoading(false);
      const message = err.message === "Invalid login credentials" 
        ? "Email atau password salah." 
        : err.message || "Terjadi kesalahan saat login.";
      toast.error("Login Gagal", { description: message });
    }
  }

  // ==========================================
  // LOGIKA DAFTAR
  // ==========================================
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cek ketersediaan Username pakai jalur VIP (lookup)
      let usernameTerpakai = false;
      try {
        const res = await lookup({ data: { username: regUsername } });
        if (res && res.email) {
          usernameTerpakai = true; // Ketemu! Berarti udah dipakai
        }
      } catch (err) {
        // Kalau error (artinya username tidak ditemukan), berarti aman dipakai!
        usernameTerpakai = false;
      }

      if (usernameTerpakai) {
        toast.error("Username tidak tersedia", {
          description: "Username ini sudah dipakai oleh pengajar lain. Silakan gunakan yang lain.",
        });
        setLoading(false);
        return;
      }

      // 2. Mendaftarkan akun ke Supabase Auth
      const { error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            full_name: regFullName,
            username: regUsername,
          },
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("Email ini sudah terdaftar. Silakan gunakan email lain atau langsung masuk.");
        }
        throw new Error(error.message);
      }

      // 3. Sukses Daftar
      toast.success("Akun berhasil dibuat!", {
        description: "Silakan masuk menggunakan akun baru Anda.",
        duration: 4000,
      });

      // Bersihkan form
      setEmailOrName(regUsername); 
      setLoginPassword("");
      setRegFullName("");
      setRegUsername("");
      setRegEmail("");
      setRegPassword("");
      
      // Lempar balik ke tampilan masuk
      setIsLoginMode(true);

    } catch (err: any) {
      console.error("Error Daftar:", err);
      toast.error("Gagal mendaftar", {
        description: err.message || "Terjadi kesalahan saat membuat akun.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--accent)_45%,_transparent),_transparent_60%)]"
      />
      <div className="w-full max-w-sm">
        
        {/* --- HEADER MECHATRON ROBOTIK SCHOOL --- */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <span className="font-display text-2xl font-bold">M</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mechatron Robotik School
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Absensi Pengajar
          </p>
        </div>

        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold">
              {isLoginMode ? "Masuk" : "Daftar Akun"}
            </CardTitle>
            <CardDescription>
              {isLoginMode 
                ? "Silakan masuk dengan akun anda." 
                : "Lengkapi data untuk membuat akun pengajar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            
            {isLoginMode ? (
              // --- FORM LOGIN ---
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ident">Email / Username</Label>
                  <Input
                    id="ident"
                    type="text" 
                    placeholder=""
                    required
                    value={emailOrName}
                    onChange={(e) => setEmailOrName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(!!v)}
                    />
                    Ingat saya
                  </label>
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
              </form>
            ) : (

              // --- FORM DAFTAR ---
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regFullName">Nama Lengkap</Label>
                  <Input
                    id="regFullName"
                    type="text"
                    placeholder=""
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regUsername">Username</Label>
                  <Input
                    id="regUsername"
                    type="text"
                    placeholder=""
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">Email Aktif</Label>
                  <Input
                    id="regEmail"
                    type="email"
                    placeholder=""
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Buat Password</Label>
                  <Input
                    id="regPassword"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                
                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? "Memproses..." : "Daftar Akun"}
                </Button>
              </form>
            )}

            {/* --- TOMBOL SWITCH HALAMAN --- */}
            <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
              {isLoginMode ? (
                <p>
                  Belum punya akun?{" "}
                  <button 
                    type="button" 
                    onClick={() => setIsLoginMode(false)}
                    className="font-medium text-primary hover:underline"
                  >
                    Daftar di sini
                  </button>
                </p>
              ) : (
                <p>
                  Sudah punya akun?{" "}
                  <button 
                    type="button" 
                    onClick={() => setIsLoginMode(true)}
                    className="font-medium text-primary hover:underline"
                  >
                    Masuk di sini
                  </button>
                </p>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}