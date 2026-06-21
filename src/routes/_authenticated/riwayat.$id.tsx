import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/riwayat/$id")({
  component: DetailPopupPage,
  notFoundComponent: () => (
    <Dialog open onOpenChange={(isOpen) => !isOpen && history.back()}>
      <DialogContent>
        <p className="py-12 text-center text-sm text-muted-foreground">
          Data tidak ditemukan.
        </p>
      </DialogContent>
    </Dialog>
  ),
  errorComponent: ({ error }) => (
    <Dialog open onOpenChange={(isOpen) => !isOpen && history.back()}>
      <DialogContent>
        <p className="py-12 text-center text-sm text-destructive">{error.message}</p>
      </DialogContent>
    </Dialog>
  ),
});

function DetailPopupPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  // State untuk form edit
  const [sesi, setSesi] = useState<"1" | "2">("1");
  const [schoolId, setSchoolId] = useState("");
  const [customSchool, setCustomSchool] = useState("");
  const [anak, setAnak] = useState("");
  const [bawaKendaraan, setBawaKendaraan] = useState<"ya" | "tidak">("tidak");
  const [materi, setMateri] = useState("");

  const handleClose = () => {
    navigate({ to: "/riwayat" });
  };

  // Tarik data sekolah aktif
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

  // Tarik detail absen (KITA TAMBAHIN created_at DI SINI)
  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendances")
        .select(
          "id, tanggal, sesi, materi, anak, bawa_kendaraan, photo_paths, school_id, custom_school_name, created_at, schools(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      
      const urls: string[] = [];
      if (data.photo_paths?.length) {
        const { data: signed } = await supabase.storage
          .from("attendance-docs")
          .createSignedUrls(data.photo_paths, 3600);
        for (const s of signed ?? []) if (s.signedUrl) urls.push(s.signedUrl);
      }
      return { ...data, photoUrls: urls };
    },
  });

  // Logika Pengecekan 24 Jam
  const handleEditClick = () => {
    if (!data) return;

    // Hitung selisih waktu sekarang dengan waktu absen dikirim (dalam milidetik)
    const now = new Date().getTime();
    const dikirim = new Date(data.created_at).getTime();
    const selisihJam = (now - dikirim) / (1000 * 60 * 60);

    if (selisihJam > 24) {
      toast.error("Waktu Edit Habis", {
        description: "Absen hanya bisa diedit maksimal 24 jam setelah dikirim.",
        duration: 4000,
      });
      return; // Berhenti di sini, jangan buka form edit
    }

    // Kalau masih dalam 24 jam, jalankan fungsi edit
    setSesi(String(data.sesi) as "1" | "2");
    if (data.school_id) {
      setSchoolId(data.school_id);
      setCustomSchool("");
    } else {
      setSchoolId("__other__");
      setCustomSchool(data.custom_school_name || "");
    }
    setAnak(data.anak || "");
    setBawaKendaraan(data.bawa_kendaraan ? "ya" : "tidak");
    setMateri(data.materi || "");
    setIsEditing(true);
  };

  // Fungsi simpan perubahan
  const mut = useMutation({
    mutationFn: async () => {
      if (!materi.trim()) throw new Error("Materi ajar wajib diisi");
      const isOther = schoolId === "__other__";
      if (isOther && !customSchool.trim()) throw new Error("Tulis nama sekolah dulu");

      const { error } = await supabase
        .from("attendances")
        .update({
          sesi: Number(sesi),
          school_id: isOther ? null : schoolId,
          custom_school_name: isOther ? customSchool.trim() : null,
          anak: anak.trim() || null,
          bawa_kendaraan: bawaKendaraan === "ya",
          materi: materi.trim(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absen berhasil diperbarui!");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["attendance", id] });
      qc.invalidateQueries({ queryKey: ["my-attendances"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui"),
  });

  return (
    <Dialog defaultOpen onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
    }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between pr-4">
            <div>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {isLoading ? "Memuat..." : (
                  <>
                    <span>
                      {data && format(new Date(data.tanggal), "EEEE, d MMMM yyyy", { locale: idLocale })}
                    </span>
                    {data && <Badge variant="secondary">Sesi {data.sesi}</Badge>}
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing ? "Perbaiki kesalahan data absen di bawah ini." : "Detail lengkap rekam absensi mengajar."}
              </DialogDescription>
            </div>
            
            {/* Tombol Edit diubah event onClick-nya */}
            {data && !isLoading && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleEditClick} className="h-8 shrink-0">
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {isLoading && <p className="py-8 text-center text-sm">Sedang mengambil data...</p>}
        {(error || (!isLoading && !data)) && (
          <p className="py-8 text-center text-sm text-destructive">Gagal memuat detail absen.</p>
        )}

        {data && !isLoading && (
          <div className="mt-4">
            {isEditing ? (
              /* === MODE EDIT === */
              <div className="space-y-4 text-sm animate-in fade-in zoom-in-95">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sesi</Label>
                    <RadioGroup value={sesi} onValueChange={(v) => setSesi(v as "1" | "2")} className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="1" /> Sesi 1</label>
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="2" /> Sesi 2</label>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label>Membawa Kendaraan?</Label>
                    <RadioGroup value={bawaKendaraan} onValueChange={(v) => setBawaKendaraan(v as "ya" | "tidak")} className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ya" /> Ya</label>
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="tidak" /> Tidak</label>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sekolah</Label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                      <SelectItem value="__other__">Lainnya…</SelectItem>
                    </SelectContent>
                  </Select>
                  {schoolId === "__other__" && (
                    <Input placeholder="Tulis nama sekolah" value={customSchool} onChange={(e) => setCustomSchool(e.target.value)} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nama Anak (opsional)</Label>
                  <Input value={anak} onChange={(e) => setAnak(e.target.value)} placeholder="Pisahkan dengan koma jika banyak" />
                </div>

                <div className="space-y-2">
                  <Label>Materi Ajar</Label>
                  <Textarea rows={4} value={materi} onChange={(e) => setMateri(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={mut.isPending}>
                    Batal
                  </Button>
                  <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                    {mut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Simpan Perubahan
                  </Button>
                </div>
              </div>
            ) : (
              /* === MODE BACA === */
              <div className="space-y-4 text-sm animate-in fade-in">
                <Field label="Sekolah" value={(data.schools as { name: string } | null)?.name ?? data.custom_school_name ?? "—"} />
                <Field label="Nama Anak" value={data.anak || "—"} />
                <Field label="Membawa Kendaraan" value={data.bawa_kendaraan ? "Ya" : "Tidak"} />
                <Field label="Materi Ajar" value={data.materi} multiline />
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Dokumentasi</div>
                  {data.photoUrls.length === 0 ? (
                    <p className="text-muted-foreground italic">Tidak ada foto.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {data.photoUrls.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`Dokumentasi ${i + 1}`} className="aspect-square w-full rounded-md border object-cover hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={multiline ? "whitespace-pre-wrap" : ""}>{value}</div>
    </div>
  );
}