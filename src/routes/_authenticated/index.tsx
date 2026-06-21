import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
// 👇 Tambahkan import ikon Camera di sini
import { Loader2, Upload, X, Wallet, CalendarDays, Settings, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Absen — Absen Pengajar" }],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if ((roles ?? []).some((r) => r.role === "admin")) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AbsenPage,
});

const fmtRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Gagal kompres foto"));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
    };
    reader.onerror = (err) => reject(err);
  });
};

function AbsenPage() {
  const { user, fullName } = useAuth();
  const navigate = useNavigate();

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const firstDay = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const lastDay = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["stats", user?.id, firstDay],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendances")
        .select("custom_price, schools(price_per_session)")
        .eq("user_id", user!.id)
        .gte("tanggal", firstDay)
        .lte("tanggal", lastDay);
      
      if (error) throw error;

      let gaji = 0;
      data.forEach((r: any) => {
        if (r.custom_price && r.custom_price > 0) gaji += r.custom_price;
        else if (r.schools?.price_per_session) gaji += r.schools.price_per_session;
      });

      return { totalSesi: data.length, estimasiGaji: gaji };
    }
  });

  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [schoolId, setSchoolId] = useState<string>("");
  const [customSchool, setCustomSchool] = useState("");
  const [bawaKendaraan, setBawaKendaraan] = useState<"ya" | "tidak">("tidak");
  const [sesi, setSesi] = useState<"1" | "2">("1");
  const [anak, setAnak] = useState("");
  const [materi, setMateri] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isOther = schoolId === "__other__";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!schoolId) {
      toast.error("Pilih sekolah dulu");
      return;
    }
    if (isOther && !customSchool.trim()) {
      toast.error("Tulis nama sekolah dulu");
      return;
    }
    if (!materi.trim()) {
      toast.error("Materi ajar wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const photoPaths: string[] = [];
      for (const file of files) {
        toast.info(`Mengompresi ${file.name}...`, { id: "compress-toast" });
        
        const compressedBlob = await compressImage(file);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        
        const { error: upErr } = await supabase.storage
          .from("attendance-docs")
          .upload(path, compressedBlob, { contentType: "image/jpeg" });
          
        if (upErr) throw upErr;
        photoPaths.push(path);
      }
      toast.dismiss("compress-toast");

      const { error } = await supabase.from("attendances").insert({
        user_id: user.id,
        tanggal,
        school_id: isOther ? null : schoolId,
        custom_school_name: isOther ? customSchool.trim() : null,
        anak: anak.trim() || null,
        sesi: Number(sesi),
        materi: materi.trim(),
        bawa_kendaraan: bawaKendaraan === "ya",
        photo_paths: photoPaths,
      });
      if (error) throw error;
      
      toast.success("Absen tersimpan", {
        description: "Data absen beserta foto sudah berhasil disimpan.",
        duration: 4000,
      });
      
      setAnak("");
      setMateri("");
      setFiles([]);
      setSchoolId("");
      setCustomSchool("");
      setBawaKendaraan("tidak");
      setSesi("1");
      setTanggal(format(new Date(), "yyyy-MM-dd"));
    } catch (err: any) {
      toast.dismiss("compress-toast");
      
      const msg = err.message?.toLowerCase() || "terjadi kesalahan";

      if (
        msg.includes("quota") || 
        msg.includes("space") || 
        msg.includes("read-only") || 
        msg.includes("exceeded")
      ) {
        toast.error("🚨 Sistem Kepenuhan!", { 
          description: "Gagal menyimpan absen karena kapasitas server sudah habis. Tolong screenshot pesan ini dan segera infokan ke Admin (Diaz) agar server dibersihkan.",
          duration: 15000,
        });
      } else {
        toast.error("Gagal menyimpan", { description: err.message || "Terjadi kesalahan" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Banner Sapaan */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary to-primary/80 px-6 py-7 text-primary-foreground shadow-lg shadow-primary/10">
        <button 
          type="button"
          onClick={() => navigate({ to: "/profile" })} 
          className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors z-10 backdrop-blur-sm"
          title="Pengaturan Akun"
        >
          <Settings className="w-5 h-5" />
        </button>
        
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-background/10 blur-3xl" />
        <p className="text-xs font-medium uppercase tracking-wider opacity-80">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale })}
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Halo, {(fullName ?? user?.email ?? "Pengajar").split(" ")[0]} 👋
        </h1>
        <p className="mt-1 max-w-md text-sm opacity-90">
          Catat sesi mengajar hari ini agar riwayatmu rapi dan mudah dicek kapan saja.
        </p>
      </div>

      {/* Dasbor Mini */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sesi Bulan Ini</p>
              <h2 className="font-display text-2xl font-bold">
                {stats?.totalSesi ?? 0} <span className="text-sm font-normal text-muted-foreground">kali</span>
              </h2>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estimasi Gaji</p>
              <h2 className="font-display text-2xl font-bold">
                {fmtRp(stats?.estimasiGaji ?? 0)}
              </h2>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Absen */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Form Absen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Nama Pengajar</Label>
              <Input value={fullName ?? user?.email ?? ""} readOnly disabled className="bg-muted/50" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tanggal">Tanggal Mengajar</Label>
                <Input
                  id="tanggal"
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sesi</Label>
                <RadioGroup
                  value={sesi}
                  onValueChange={(v) => setSesi(v as "1" | "2")}
                  className="flex gap-4 pt-2"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="1" /> Sesi 1
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="2" /> Sesi 2
                  </label>
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sekolah</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih sekolah" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__">Lainnya…</SelectItem>
                </SelectContent>
              </Select>
              {isOther && (
                <Input
                  placeholder="Tulis nama sekolah"
                  value={customSchool}
                  onChange={(e) => setCustomSchool(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="anak">Nama Anak (opsional)</Label>
              <Input
                id="anak"
                placeholder="Pisahkan dengan koma jika lebih dari satu"
                value={anak}
                onChange={(e) => setAnak(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Membawa Kendaraan?</Label>
              <RadioGroup
                value={bawaKendaraan}
                onValueChange={(v) => setBawaKendaraan(v as "ya" | "tidak")}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="ya" /> Ya
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="tidak" /> Tidak
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materi">Materi Ajar</Label>
              <Textarea
                id="materi"
                rows={3}
                required
                value={materi}
                onChange={(e) => setMateri(e.target.value)}
              />
            </div>

            {/* ========================================= */}
            {/* FITUR KAMERA & UPLOAD FILE DI SINI        */}
            {/* ========================================= */}
            <div className="space-y-2">
              <Label>Dokumentasi (Foto)</Label>
              <div className="grid grid-cols-2 gap-3">
                
                {/* 1. Tombol Buka Galeri Biasa */}
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 py-5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors">
                  <Upload className="h-5 w-5 mb-1" />
                  <span className="font-medium text-xs sm:text-sm">Pilih Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []);
                      setFiles((prev) => [...prev, ...list]);
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* 2. Tombol Jepret Kamera Langsung */}
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 py-5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors">
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="font-medium text-xs sm:text-sm">Buka Kamera</span>
                  {/* Sihir HTML5: atribut capture="environment" untuk buka kamera belakang */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []);
                      setFiles((prev) => [...prev, ...list]);
                      e.target.value = "";
                    }}
                  />
                </label>

              </div>
              <p className="text-[11px] text-muted-foreground">Foto akan dikompres otomatis agar ringan dan hemat kuota.</p>

              {/* Tampilan List Foto yang Mau Diupload */}
              {files.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm bg-muted/20 p-2 rounded-md border">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/50"
                    >
                      <span className="truncate text-xs font-medium max-w-[200px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-muted-foreground hover:text-destructive bg-background rounded-full p-1 shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full mt-4 h-11">
              {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {submitting ? "Memproses & Menyimpan..." : "Simpan Absen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}