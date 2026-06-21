import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Check, Pencil, X, Trash2, Download } from "lucide-react";
import ExcelJS from "exceljs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/pengajar/$id")({
  head: () => ({ meta: [{ title: "Admin · Detail Pengajar" }] }),
  component: AdminTeacherDetailPage,
});

const fmtRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

function AdminTeacherDetailPage() {
  const { id } = Route.useParams();
  const today = new Date();
  const defaultFrom = format(
    new Date(today.getFullYear(), today.getMonth(), 1),
    "yyyy-MM-dd",
  );
  const defaultTo = format(today, "yyyy-MM-dd");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data: profile } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, price_per_session");
      if (error) throw error;
      return data;
    },
  });
  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s])),
    [schools],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["teacher-attendances", id, from, to],
    queryFn: async () => {
      let q = supabase
        .from("attendances")
        .select(
          "id, tanggal, school_id, sesi, materi, anak, bawa_kendaraan, photo_paths, custom_school_name, custom_price",
        )
        .eq("user_id", id)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (from) q = q.gte("tanggal", from);
      if (to) q = q.lte("tanggal", to);
      const { data, error } = await q;
      if (error) throw error;
      const allPaths = (data ?? []).flatMap((r) => r.photo_paths ?? []);
      const urlMap = new Map<string, string>();
      if (allPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("attendance-docs")
          .createSignedUrls(allPaths, 3600);
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
        }
      }
      return (data ?? []).map((r) => ({
        ...r,
        photoUrls: (r.photo_paths ?? [])
          .map((p) => urlMap.get(p))
          .filter((u): u is string => !!u),
      }));
    },
  });

  // Effective price: custom_price overrides the school default when set (>0)
  const effectivePrice = (r: (typeof rows)[number]) => {
    if (r.custom_price && r.custom_price > 0) return r.custom_price;
    if (r.school_id) return schoolMap[r.school_id]?.price_per_session ?? 0;
    return 0;
  };

  const summary = useMemo(() => {
    const perGroup = new Map<
      string,
      { name: string; count: number; subtotal: number }
    >();
    let grand = 0;
    for (const r of rows) {
      const school = r.school_id ? schoolMap[r.school_id] : null;
      const name = school?.name ?? r.custom_school_name ?? "—";
      const price = effectivePrice(r);
      const key = r.school_id ?? `custom:${name}`;
      const cur = perGroup.get(key) ?? { name, count: 0, subtotal: 0 };
      cur.count += 1;
      cur.subtotal += price;
      perGroup.set(key, cur);
      grand += price;
    }
    return {
      bySchool: Array.from(perGroup.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      total: grand,
      sessions: rows.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, schoolMap]);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin">
          <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile?.full_name ?? "Pengajar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan absen & estimasi gaji per periode.
          </p>
        </div>
        
        {/* Tombol akan muncul kalau data profilnya sudah ditarik */}
        {profile && (
          <ExportExcelButton 
            teacherId={id} 
            teacherName={profile.full_name ?? "Pengajar"} 
            schoolMap={schoolMap} 
          />
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estimasi Gaji Periode Ini
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="font-display text-3xl font-semibold">
            {fmtRp(summary.total)}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.sessions} sesi mengajar
          </p>
          {summary.bySchool.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              {summary.bySchool.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {b.name}{" "}
                    <span className="text-muted-foreground">
                      · {b.count} sesi
                    </span>
                  </span>
                  <span className="font-medium">{fmtRp(b.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Detail Absen
        </h2>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Tidak ada absen pada periode ini.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const school = r.school_id ? schoolMap[r.school_id] : null;
              const name = school?.name ?? r.custom_school_name ?? "—";
              const defaultPrice = school?.price_per_session ?? 0;
              const isCustom = !r.school_id;
              const overridden = !!(r.custom_price && r.custom_price > 0);
              return (
                <Card key={r.id}>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {format(new Date(r.tanggal), "d MMM yyyy", {
                            locale: idLocale,
                          })}
                        </span>
                        <Badge variant="secondary">Sesi {r.sesi}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {name}
                        </span>
                        {isCustom && (
                          <Badge variant="outline" className="text-[10px]">
                            Lainnya
                          </Badge>
                        )}
                        {overridden && !isCustom && (
                          <Badge variant="outline" className="text-[10px]">
                            Harga override
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <PriceEditor
                          attendanceId={r.id}
                          value={r.custom_price ?? 0}
                          fallback={defaultPrice}
                          forceCustom={isCustom}
                        />
                        <DeleteAttendanceButton
                          attendanceId={r.id}
                          photoPaths={r.photo_paths ?? []}
                        />
                      </div>
                    </div>
                    {r.anak && (
                      <p className="text-xs text-muted-foreground">
                        Anak: {r.anak}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{r.materi}</p>
                    {r.photoUrls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5 pt-1 sm:grid-cols-4">
                        {r.photoUrls.map((u, i) => (
                          <a
                            key={i}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <img
                              src={u}
                              alt={`Bukti ${i + 1}`}
                              loading="lazy"
                              className="aspect-square w-full rounded-md border object-cover transition-opacity hover:opacity-90"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground">
                        Tidak ada foto bukti.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceEditor({
  attendanceId,
  value,
  fallback,
  forceCustom,
}: {
  attendanceId: string;
  value: number;
  fallback: number;
  forceCustom?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || fallback || 0));

  const mut = useMutation({
    mutationFn: async (newVal: number | null) => {
      const { error } = await supabase
        .from("attendances")
        .update({ custom_price: newVal })
        .eq("id", attendanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Harga diperbarui");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["teacher-attendances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  const displayed = value > 0 ? value : fallback;
  const overridden = value > 0;

  if (!editing) {
    return (
      <div className="flex items-center gap-1">
        <span
          className={`text-sm font-medium ${displayed === 0 ? "text-muted-foreground italic" : ""}`}
        >
          {displayed === 0 ? "Belum diatur" : fmtRp(displayed)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            setDraft(String(displayed));
            setEditing(true);
          }}
          title={forceCustom ? "Atur harga" : "Override harga sesi ini"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {overridden && !forceCustom && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => mut.mutate(null)}
            disabled={mut.isPending}
            title="Reset ke harga default sekolah"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        className="h-8 w-28"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => mut.mutate(Number(draft) || 0)}
        disabled={mut.isPending}
        title="Simpan"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setEditing(false)}
        title="Batal"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DeleteAttendanceButton({
  attendanceId,
  photoPaths,
}: {
  attendanceId: string;
  photoPaths: string[];
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      if (photoPaths.length > 0) {
        await supabase.storage.from("attendance-docs").remove(photoPaths);
      }
      const { error } = await supabase
        .from("attendances")
        .delete()
        .eq("id", attendanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absen dihapus");
      qc.invalidateQueries({ queryKey: ["teacher-attendances"] });
      qc.invalidateQueries({ queryKey: ["admin-attendances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Hapus absen"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus absen ini?</AlertDialogTitle>
          <AlertDialogDescription>
            Data absen dan foto buktinya akan dihapus permanen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// === FUNGSI DOWNLOAD EXCEL (VERSI TEMPLATE) ===
function ExportExcelButton({
  teacherId,
  teacherName,
  schoolMap,
}: {
  teacherId: string;
  teacherName: string;
  schoolMap: Record<string, any>;
}) {
  const today = new Date();
  const [from, setFrom] = useState(
    format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil datanya kita PERKECIL, cuma tarik yang penting-penting aja
      let q = supabase
        .from("attendances")
        .select(
          "tanggal, school_id, custom_school_name, custom_price"
        )
        .eq("user_id", teacherId)
        .gte("tanggal", from)
        .lte("tanggal", to)
        .order("tanggal", { ascending: true });

      const { data, error } = await q;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Tidak ada absen di rentang tanggal ini.");
        setIsLoading(false);
        return;
      }

      // 2. Tarik file template dari folder public
      const response = await fetch("/template_absen.xlsx");
      if (!response.ok) {
        throw new Error("File template_absen.xlsx tidak ditemukan di folder public!");
      }
      const arrayBuffer = await response.arrayBuffer();

      // 3. Baca template
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
         throw new Error("Sheet pertama tidak ditemukan di dalam template.");
      }

      // 4. Masukkan data ke dalam template
      let startRow = 2; // Baris awal data ditulis (asumsi header ada di baris 4)

      data.forEach((r) => {
        const school = r.school_id ? schoolMap[r.school_id] : null;
        const name = school?.name ?? r.custom_school_name ?? "Lainnya";
        
        let price = 0;
        if (r.custom_price && r.custom_price > 0) price = r.custom_price;
        else if (r.school_id) price = school?.price_per_session ?? 0;

        const row = worksheet.getRow(startRow);

        // KITA CUMA MENGISI 3 KOLOM:
        row.getCell(1).value = r.tanggal; // Kolom 1 (A) -> Tanggal
        row.getCell(2).value = name;      // Kolom 2 (B) -> Nama Sekolah
        row.getCell(3).value = price;     // Kolom 3 (C) -> Gaji

        row.commit();
        
        startRow++;
      });

      // 5. Download hasilnya
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Rekap_${teacherName.replace(/\s+/g, "_")}_${from}_sd_${to}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("File berhasil dibuat dan diunduh!");
      setOpen(false);
    } catch (err: any) {
      toast.error("Gagal mengunduh file.");
      console.error(err);
      if (err.message) {
         toast.error(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Download Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Data Absen</DialogTitle>
          <DialogDescription>
            Pilih rentang waktu untuk mengunduh rekap gaji <strong className="text-foreground">{teacherName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label>Dari Tanggal</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sampai Tanggal</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleDownload} disabled={isLoading}>
            {isLoading ? "Menyiapkan..." : "Download File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}