// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Calendar as CalendarIcon, Edit2, Trash2, CalendarOff, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/jadwal")({
  head: () => ({
    meta: [{ title: "Master Jadwal — Admin" }],
  }),
  component: AdminJadwalPage,
});

function AdminJadwalPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- STATE JADWAL RUTIN ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [hari, setHari] = useState("1");
  const [sesi, setSesi] = useState("");
  const [jamMulai, setJamMulai] = useState("13:00");
  const [jamSelesai, setJamSelesai] = useState("14:00");

  // --- STATE JADWAL DADAKAN (EXCEPTION) ---
  const [excOpen, setExcOpen] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);
  const [excTanggal, setExcTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [excStatus, setExcStatus] = useState("LIBUR");
  const [excJamMulai, setExcJamMulai] = useState("");
  const [excJamSelesai, setExcJamSelesai] = useState("");
  const [excKeterangan, setExcKeterangan] = useState("");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: jadwalRutin, isLoading } = useQuery({
    queryKey: ["jadwal-rutin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jadwal_rutin" as any)
        .select(`
          id, hari, sesi, jam_mulai, jam_selesai, school_id, user_id,
          schools ( name ),
          profiles ( id, full_name ),
          jadwal_pengecualian ( id, tanggal, status, jam_mulai_baru, jam_selesai_baru, keterangan )
        `)
        // Cukup urutkan jam mulai saja di database, harinya kita kelompokkan di frontend
        .order("jam_mulai", { ascending: true }); 

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: schoolsList } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: profilesList } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  // Urutan ideal untuk tampilan: Senin (1) sampai Minggu (0)
  const urutanHari = [1, 2, 3, 4, 5, 6, 0];

  // ==========================================
  // FUNGSI JADWAL RUTIN (MASTER)
  // ==========================================
  function handleAdd() {
    setEditingId(null);
    setUserIds([]);
    setSchoolId("");
    setHari("1");
    setSesi("");
    setJamMulai("13:00");
    setJamSelesai("14:00");
    setOpen(true);
  }

  function handleEdit(jadwal: any) {
    setEditingId(jadwal.id);
    setUserIds([jadwal.user_id]);
    setSchoolId(jadwal.school_id);
    setHari(jadwal.hari.toString());
    setSesi(jadwal.sesi || "");
    setJamMulai(jadwal.jam_mulai.slice(0, 5));
    setJamSelesai(jadwal.jam_selesai.slice(0, 5));
    setOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Yakin ingin menghapus jadwal ini?")) return;
    const { error } = await supabase.from("jadwal_rutin" as any).delete().eq("id", id);
    if (error) toast.error("Gagal menghapus", { description: error.message });
    else {
      toast.success("Jadwal dihapus");
      queryClient.invalidateQueries({ queryKey: ["jadwal-rutin"] });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userIds.length === 0 || !schoolId) return toast.error("Pengajar dan Sekolah wajib dipilih!");
    setSubmitting(true);

    const payload = userIds.map((uid) => ({
      user_id: uid, school_id: schoolId, hari: parseInt(hari), sesi, jam_mulai: jamMulai, jam_selesai: jamSelesai,
    }));

    try {
      if (editingId) {
        const { error } = await supabase.from("jadwal_rutin" as any).update(payload[0]).eq("id", editingId);
        if (error) throw error;
        toast.success("Jadwal diperbarui!");
      } else {
        const { error } = await supabase.from("jadwal_rutin" as any).insert(payload);
        if (error) throw error;
        toast.success("Jadwal ditambahkan!");
      }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["jadwal-rutin"] });
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // FUNGSI JADWAL DADAKAN (EXCEPTION)
  // ==========================================
  function handleOpenException(jadwal: any) {
    setSelectedJadwal(jadwal);
    setExcTanggal(todayStr);
    setExcStatus("LIBUR");
    setExcJamMulai(jadwal.jam_mulai.slice(0, 5));
    setExcJamSelesai(jadwal.jam_selesai.slice(0, 5));
    setExcKeterangan("");
    setExcOpen(true);
  }

  async function onSubmitException(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        jadwal_rutin_id: selectedJadwal.id,
        tanggal: excTanggal,
        status: excStatus,
        jam_mulai_baru: excStatus === "GANTI_JAM" ? excJamMulai : null,
        jam_selesai_baru: excStatus === "GANTI_JAM" ? excJamSelesai : null,
        keterangan: excKeterangan || null,
      };

      const { error } = await supabase.from("jadwal_pengecualian" as any).insert(payload);
      if (error) throw error;

      toast.success("Catatan dadakan berhasil dipasang!");
      setExcOpen(false);
      queryClient.invalidateQueries({ queryKey: ["jadwal-rutin"] });
    } catch (err: any) {
      toast.error("Gagal pasang jadwal", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteException(excId: string) {
    if (!window.confirm("Batalin catatan dadakan ini?")) return;
    const { error } = await supabase.from("jadwal_pengecualian" as any).delete().eq("id", excId);
    if (error) toast.error("Gagal membatalkan", { description: error.message });
    else {
      toast.success("Catatan dadakan dibatalkan");
      queryClient.invalidateQueries({ queryKey: ["jadwal-rutin"] });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Master Jadwal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur jadwal mengajar rutin mingguan di sini.
          </p>
        </div>
        
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Jadwal
        </Button>
      </div>

      {/* Modal Master Jadwal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ubah Jadwal Rutin" : "Tambah Jadwal Rutin"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Pilih Pengajar {editingId ? "" : "(Bisa lebih dari 1)"}</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-muted/10">
                {profilesList?.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors">
                    <Checkbox
                      checked={userIds.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (editingId) setUserIds(checked ? [p.id] : []);
                        else {
                          if (checked) setUserIds((prev) => [...prev, p.id]);
                          else setUserIds((prev) => prev.filter((id) => id !== p.id));
                        }
                      }}
                    />
                    {p.full_name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sekolah</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger><SelectValue placeholder="Pilih Sekolah" /></SelectTrigger>
                <SelectContent>
                  {schoolsList?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select value={hari} onValueChange={setHari}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Senin</SelectItem>
                    <SelectItem value="2">Selasa</SelectItem>
                    <SelectItem value="3">Rabu</SelectItem>
                    <SelectItem value="4">Kamis</SelectItem>
                    <SelectItem value="5">Jumat</SelectItem>
                    <SelectItem value="6">Sabtu</SelectItem>
                    <SelectItem value="0">Minggu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sesi / Keterangan</Label>
                <Input placeholder="Cth: Kelas 1-3" value={sesi} onChange={(e) => setSesi(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" required value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" required value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Jadwal"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Jadwal Dadakan (Sticky Note) */}
      <Dialog open={excOpen} onOpenChange={setExcOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ubah Khusus Hari Ini</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitException} className="space-y-4 mt-2">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{selectedJadwal?.profiles?.full_name}</p>
              <p className="text-muted-foreground">{selectedJadwal?.schools?.name} ({selectedJadwal?.sesi})</p>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Perubahan</Label>
              <Input type="date" required value={excTanggal} onChange={(e) => setExcTanggal(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={excStatus} onValueChange={setExcStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIBUR">Libur</SelectItem>
                  <SelectItem value="GANTI_JAM">Ganti Jam / Pindah Tanggal</SelectItem>
                  <SelectItem value="SELESAI">Sudah Selesai (Batal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {excStatus === "GANTI_JAM" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jam Mulai Baru</Label>
                  <Input type="time" required value={excJamMulai} onChange={(e) => setExcJamMulai(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Jam Selesai Baru</Label>
                  <Input type="time" required value={excJamSelesai} onChange={(e) => setExcJamSelesai(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Keterangan (Opsional)</Label>
              <Textarea 
                placeholder="Cth: Sekolah sedang ujian / class meeting" 
                value={excKeterangan} 
                onChange={(e) => setExcKeterangan(e.target.value)} 
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Perubahan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* List Kartu Jadwal Dikelompokkan Per Hari */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Daftar Jadwal Aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !jadwalRutin || jadwalRutin.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-muted-foreground">Belum ada jadwal yang didaftarkan.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 bg-muted/10">
              {urutanHari.map((hariIdx) => {
                // Saring jadwal yang harinya cocok dengan iterasi (Laci)
                const listJadwalHariIni = jadwalRutin.filter((j: any) => j.hari === hariIdx);
                
                // Kalau nggak ada jadwal di hari ini, skip lacinya (jangan dirender)
                if (listJadwalHariIni.length === 0) return null;

                return (
                  <div key={hariIdx} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                    
                    {/* Header Laci (Nama Hari & Total Sesi) */}
                    <div className="bg-primary/5 px-4 py-2.5 border-b flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-primary uppercase tracking-wide text-sm">{namaHari[hariIdx]}</h3>
                      <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {listJadwalHariIni.length} Sesi
                      </span>
                    </div>

                    {/* Isi Laci (Kartu-Kartu Jadwal) */}
                    <div className="divide-y divide-border/50">
                      {listJadwalHariIni.map((jadwal: any) => {
                        const upcomingExc = jadwal.jadwal_pengecualian
                          ?.filter((e: any) => e.tanggal >= todayStr)
                          .sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal));

                        return (
                          <div key={jadwal.id} className="flex flex-col p-4 hover:bg-muted/5 transition-colors">
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                              {/* Info Jam & Sesi */}
                              <div>
                                <p className="font-semibold text-lg text-foreground">
                                  {jadwal.jam_mulai.slice(0,5)} - {jadwal.jam_selesai.slice(0,5)}
                                </p>
                                <p className="text-sm text-muted-foreground">Sesi: {jadwal.sesi}</p>
                              </div>
                              
                              <div className="mt-3 flex flex-row items-center justify-between sm:mt-0 sm:justify-end sm:gap-4">
                                {/* Info Sekolah & Pengajar */}
                                <div className="text-left sm:text-right">
                                  <p className="font-medium text-primary">{jadwal.schools?.name}</p>
                                  <p className="text-sm text-muted-foreground">{jadwal.profiles?.full_name}</p>
                                </div>

                                {/* Tombol Aksi */}
                                <div className="flex items-center gap-2 ml-2 sm:ml-4 border-l pl-2 sm:pl-4">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                                    onClick={() => handleOpenException(jadwal)}
                                    title="Ubah Khusus Hari Ini"
                                  >
                                    <CalendarOff className="h-4 w-4 sm:mr-1.5" />
                                    <span className="hidden sm:inline text-xs">Dadakan</span>
                                  </Button>

                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => handleEdit(jadwal)}
                                    title="Edit Master Jadwal"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                                    onClick={() => handleDelete(jadwal.id)}
                                    title="Hapus Master Jadwal"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Stempel Pengecualian Dadakan */}
                            {upcomingExc && upcomingExc.length > 0 && (
                              <div className="mt-4 bg-amber-50/50 border border-amber-200/60 rounded-lg p-3 text-xs">
                                <span className="font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                                  <CalendarOff className="h-3.5 w-3.5" /> Pengecualian / Jadwal Dadakan Mendatang:
                                </span>
                                <div className="space-y-2">
                                  {upcomingExc.map((exc: any) => (
                                    <div key={exc.id} className="flex justify-between items-center bg-white p-2 rounded-md border border-amber-100 shadow-sm">
                                      <div>
                                        <span className="font-medium text-amber-900">
                                          {format(new Date(exc.tanggal), "dd MMM yyyy", { locale: idLocale })}
                                        </span>
                                        <span className="mx-2 text-amber-600/50">•</span>
                                        <span className="font-bold text-amber-700">{exc.status}</span>
                                        
                                        {exc.status === "GANTI_JAM" && (
                                          <span className="ml-1 font-medium text-amber-600">
                                            ({exc.jam_mulai_baru?.slice(0,5)} - {exc.jam_selesai_baru?.slice(0,5)})
                                          </span>
                                        )}
                                        
                                        {exc.keterangan && (
                                          <span className="ml-1 italic text-muted-foreground">- {exc.keterangan}</span>
                                        )}
                                      </div>
                                      <button 
                                        onClick={() => handleDeleteException(exc.id)} 
                                        className="text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors" 
                                        title="Batalkan Pengecualian"
                                      >
                                        <X className="h-3.5 w-3.5"/>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
