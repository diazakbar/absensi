import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale"; // Menggunakan bahasa Indonesia untuk hari & bulan
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { School, Users, Trophy, ChevronRight, BarChart3, Clock, Activity } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin · Dashboard" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  // State untuk memicu animasi grafik melar
  const [animateChart, setAnimateChart] = useState(false);

  // 1. Tarik Data Total Sekolah
  const { data: totalSchools = 0 } = useQuery({
    queryKey: ["count-schools"],
    queryFn: async () => {
      const { count, error } = await supabase.from("schools").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // 2. Tarik Data Total Pengajar
  const { data: totalUsers = 0 } = useQuery({
    queryKey: ["count-users"],
    queryFn: async () => {
      const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // 3. Mesin Hitung Leaderboard (Tahunan)
  const { data: leaderboard = [], isLoading: loadLeaderboard } = useQuery({
    queryKey: ["leaderboard-absen-tahunan"],
    queryFn: async () => {
      const now = new Date();
      const startOfYear = format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd");
      
      const { data: absenData, error: absenErr } = await supabase.from("attendances").select("user_id").gte("tanggal", startOfYear);
      if (absenErr) throw absenErr;

      const { data: profilesData, error: profErr } = await supabase.from("profiles").select("id, full_name");
      if (profErr) throw profErr;

      const counts: Record<string, { id: string; name: string; count: number }> = {};
      
      absenData.forEach((row: any) => {
        const uid = row.user_id;
        if (!counts[uid]) {
          const matchedProfile = profilesData.find(p => p.id === uid);
          counts[uid] = { id: uid, name: matchedProfile?.full_name || "Pengajar Tanpa Nama", count: 0 };
        }
        counts[uid].count += 1;
      });

      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });

  // 4. MESIN PENCATAT LOGS REAL-TIME (Ambil 10 data absen terbaru yang disubmit)
  const { data: activityLogs = [], isLoading: loadLogs } = useQuery({
    queryKey: ["admin-activity-logs"],
    // Di-refresh otomatis setiap 10 detik agar logs selalu up-to-date!
    refetchInterval: 10000, 
    queryFn: async () => {
      // Ambil data kiriman terbaru berdasarkan waktu dibuat (created_at) beserta info sekolah
      const { data: rawAbsen, error: absenErr } = await supabase
        .from("attendances")
        .select("user_id, created_at, custom_school_name, school_id, schools(name)")
        .order("created_at", { ascending: false })
        .limit(10); // Tampilkan 10 riwayat pengiriman terbaru saja

      if (absenErr) throw absenErr;

      // Ambil nama profil pengajar
      const { data: rawProfiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profErr) throw profErr;

      // Jahit data log dengan nama asli pengajar
      return rawAbsen.map((absen: any) => {
        const matchedUser = rawProfiles.find(p => p.id === absen.user_id);
        const schoolName = absen.schools?.name || absen.custom_school_name || "Sekolah Lainnya";
        return {
          id: absen.created_at + absen.user_id, // Unik ID untuk key react
          name: matchedUser?.full_name || "Pengajar Tanpa Nama",
          schoolName,
          timestamp: absen.created_at // Waktu murni dari server Supabase
        };
      });
    }
  });

  // Efek Animasi Grafik
  useEffect(() => {
    if (!loadLeaderboard && leaderboard.length > 0) {
      const timer = setTimeout(() => setAnimateChart(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loadLeaderboard, leaderboard]);

  const maxAbsen = leaderboard.length > 0 ? Math.max(...leaderboard.map(l => l.count)) : 1;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ringkasan data sekolah, pengajar, dan aktivitas absen terbaru.
        </p>
      </div>

      {/* Baris Kartu Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/admin/sekolah" className="block group">
          <Card className="border-border/60 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                  <School className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data Sekolah</p>
                  <h2 className="font-display text-2xl font-bold">{totalSchools} <span className="text-sm font-normal text-muted-foreground">lokasi</span></h2>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin" className="block group">
          <Card className="border-border/60 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data Pengajar</p>
                  <h2 className="font-display text-2xl font-bold">{totalUsers} <span className="text-sm font-normal text-muted-foreground">orang</span></h2>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Grafik Statistik Piala */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-sm sm:text-base">Statistik Pengajar Teraktif (Tahun Ini)</h3>
          </div>
        </div>
        <CardContent className="p-6">
          {loadLeaderboard ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Merender grafik...</p>
          ) : leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data absen di tahun ini.</p>
          ) : (
            <div className="space-y-6">
              {leaderboard.map((item, index) => {
                const percent = Math.max((item.count / maxAbsen) * 100, 2);
                const barColor = 
                  index === 0 ? "from-amber-400 to-amber-600 shadow-amber-500/30" : 
                  index === 1 ? "from-slate-300 to-slate-400 shadow-slate-400/30" : 
                  index === 2 ? "from-orange-400 to-orange-600 shadow-orange-500/30" : 
                  "from-primary/40 to-primary/60";

                return (
                  <Link key={item.id} to="/admin/absensi" className="block group relative">
                    <div className="flex justify-between items-end mb-1.5 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground/50 w-3">{index + 1}.</span>
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                        {item.count} <span className="text-xs font-normal">sesi</span>
                      </span>
                    </div>
                    <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full bg-gradient-to-r shadow-sm transition-all ease-out ${barColor}`}
                        style={{ 
                          width: animateChart ? `${percent}%` : "0%",
                          transitionDuration: "1200ms", 
                          transitionDelay: `${index * 150}ms`
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================== */}
      {/* 🚀 KOTAK FITUR BARU: TIMELINE AUDIT LOGS AKTIVITAS TERBARU */}
      {/* ========================================================== */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-destructive animate-pulse" />
            <h3 className="font-medium text-sm sm:text-base">Logs Aktivitas Pengajar (Real-time)</h3>
          </div>
        </div>
        
        <CardContent className="p-6">
          {loadLogs ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Membaca rekaman log...</p>
          ) : activityLogs.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">Belum ada aktivitas pengiriman form absensi.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-muted pl-4 ml-2 space-y-6">
              {activityLogs.map((log: any) => (
                <div key={log.id} className="relative group">
                  
                  {/* Titik indikator timeline kecil */}
                  <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted group-hover:bg-primary group-hover:border-primary/30 transition-all" />
                  
                  <div>
                    {/* Info baris deskripsi aktivitas */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong className="text-foreground font-semibold">{log.name}</strong> berhasil mengirim form absen di <span className="text-foreground font-medium">"{log.schoolName}"</span>
                    </p>
                    
                    {/* Waktu detail: Hari, tanggal, jam, menit, detik (Sesuai mintamu!) */}
                    <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary/60" />
                      {format(new Date(log.timestamp), "EEEE, d MMMM yyyy — HH:mm:ss", { locale: idLocale })} WIB
                    </p>
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* ========================================================== */}

    </div>
  );
}
