import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Check, Pencil, X, Upload, Loader2, FileSpreadsheet, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sekolah")({
  head: () => ({ meta: [{ title: "Admin · Sekolah" }] }),
  component: AdminSchoolsPage,
});

const fmtRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

function AdminSchoolsPage() {
  const qc = useQueryClient();
  
  // State untuk tambah manual
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");

  // State untuk CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Mutasi Tambah Manual
  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schools").insert({
        name: name.trim(),
        price_per_session: Number(price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setPrice("");
      toast.success("Sekolah ditambahkan");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["schools-active"] });
      qc.invalidateQueries({ queryKey: ["schools-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  // Mutasi Toggle Aktif/Nonaktif
  const toggleMut = useMutation({
    mutationFn: async (s: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("schools")
        .update({ active: s.active })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["schools-active"] });
    },
  });

  // Mutasi Hapus
  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dihapus");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["schools-active"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Gagal menghapus", {
        description:
          "Sekolah mungkin masih dipakai oleh absen. Nonaktifkan saja.",
      }),
  });

  // MESIN PEMBUAT TEMPLATE CSV
  const downloadTemplate = () => {
    const csvContent = "Nama Sekolah,Harga Per Sesi\nSD Contoh Cendekia,50000\nSMP Contoh Al-Azhar,100000";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Data_Sekolah.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // MESIN PENYEDOT CSV
  const processCSV = async (file: File) => {
    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("File kosong");

        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) throw new Error("Format tidak valid atau data kosong. Pastikan ada baris judul.");

        const delimiter = lines[0].includes(";") ? ";" : ",";
        const dataToInsert = [];
        
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(delimiter);
          if (columns.length >= 2) {
            const rowName = columns[0].trim();
            const priceStr = columns[1].replace(/[^0-9]/g, "");
            const price_per_session = Number(priceStr) || 0;

            if (rowName) {
              dataToInsert.push({ name: rowName, price_per_session, active: true });
            }
          }
        }

        if (dataToInsert.length === 0) throw new Error("Tidak ada data valid yang bisa dimasukkan");

        const { error } = await supabase.from("schools").insert(dataToInsert);
        if (error) throw error;

        toast.success(`Upload Berhasil! 🎉`, { 
          description: `${dataToInsert.length} data sekolah sukses ditambahkan ke sistem.`,
          duration: 5000 
        });
        
        qc.invalidateQueries({ queryKey: ["admin-schools"] });
        qc.invalidateQueries({ queryKey: ["schools-active"] });
        setIsOpen(false);
        
      } catch (err: any) {
        toast.error("Upload Gagal", { description: err.message });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      toast.error("Gagal membaca file CSV dari perangkat ini.");
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header dengan Tombol Upload CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-5 rounded-xl border border-primary/10">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Data Sekolah</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola daftar sekolah dan harga per sesinya.
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="shadow-sm shrink-0">
          <Upload className="w-4 h-4 mr-2" /> Upload CSV
        </Button>
      </div>

      {/* Form Tambah Manual */}
      <Card>
        <CardContent className="pt-6">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) addMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Tambah Manual (Nama Sekolah)</Label>
              <Input
                placeholder="cth. SD Cendekia"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Harga / Sesi (Rp)</Label>
              <Input
                type="number"
                min={0}
                placeholder="50000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={addMut.isPending || !name.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Daftar Sekolah */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="space-y-2">
          {schools.map((s) => (
            <SchoolRow
              key={s.id}
              school={s}
              onToggle={(active) => toggleMut.mutate({ id: s.id, active })}
              onDelete={() => delMut.mutate(s.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog Upload CSV (Dengan Tombol Download Template) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Data Masal</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2 space-y-4">
                <p>
                  Pilih file <strong className="text-foreground">.CSV</strong> yang disimpan dari Excel. Format kolom wajib:
                </p>
                <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/50 p-3">
                  <span className="font-mono text-xs text-primary">
                    A: Nama Sekolah <br/>B: Harga Per Sesi
                  </span>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 h-8">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Template
                  </Button>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-2 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl p-8 hover:bg-primary/10 transition-colors">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef}
              className="hidden" 
              id="csv-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processCSV(file);
              }}
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center text-center w-full">
              {isUploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                  <span className="text-sm font-medium text-primary">Sedang memproses data...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-primary mb-3" />
                  <span className="text-sm font-medium">Klik di sini untuk pilih file CSV</span>
                  <span className="text-xs text-muted-foreground mt-1">Maksimal 1 file sekali upload</span>
                </>
              )}
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SchoolRow = {
  id: string;
  name: string;
  active: boolean;
  price_per_session: number;
};

// Komponen Baris Sekolah
function SchoolRow({
  school,
  onToggle,
  onDelete,
}: {
  school: SchoolRow;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(school.name);
  const [price, setPrice] = useState(String(school.price_per_session));

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("schools")
        .update({
          name: name.trim(),
          price_per_session: Number(price) || 0,
        })
        .eq("id", school.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tersimpan");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["schools-active"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
        {editing ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_160px]">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        ) : (
          <div className="min-w-0">
            <div className="font-medium">{school.name}</div>
            <div className="text-xs text-muted-foreground">
              {fmtRp(school.price_per_session)} / sesi ·{" "}
              {school.active ? "Aktif" : "Nonaktif"}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                title="Simpan"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(school.name);
                  setPrice(String(school.price_per_session));
                }}
                title="Batal"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Switch
                checked={school.active}
                onCheckedChange={(v) => onToggle(v)}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Hapus">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus sekolah?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hanya bisa dihapus jika belum dipakai pada absen
                      manapun. Kalau gagal, gunakan tombol nonaktif.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}