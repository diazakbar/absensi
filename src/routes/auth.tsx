// @ts-nocheck
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
      { title: "Mechatron Robotik School" },
      { name: "description", content: "Absensi pengajar Mechatron Robotik School." },
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--accent)_45%,_transparent),_transparent_60%)]"
      />
      <div className="w-full max-w-sm relative z-10">
        
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

      {/* ========================================== */}
      {/* FLOATING BUBBLE WHATSAPP (BEL DARURAT)     */}
      {/* ========================================== */}
      <a
        // Ganti 628XXXXXXXXXX dengan nomor WhatsApp kamu sebagai Admin
        href="https://wa.me/6285779104077?text=Halo%20Admin,%20saya%20butuh%20bantuan%20terkait%20login."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:shadow-xl group"
        aria-label="Hubungi Admin via WhatsApp"
      >
        <WhatsAppIcon className="h-7 w-7" />
        
        {/* Tooltip Kecil yang Muncul Pas Di-hover */}
        <span className="absolute right-[4.5rem] scale-0 w-max rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-md transition-all duration-300 group-hover:scale-100 origin-right border border-border">
          Butuh bantuan? Chat Admin
          {/* Segitiga Ekor Tooltip */}
          <div className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-white border-r border-t border-border"></div>
        </span>
      </a>

    </div>
  );
}

// Ikon Resmi WhatsApp (SVG)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.305-.888-.653-1.488-1.46-1.662-1.759-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  );
}
