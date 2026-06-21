import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Server, Database, ImageMinus, History, Loader2, AlertTriangle } from "lucide-react";

export function ServerManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  // 1. FUNGSI NUKLIR: Bersihkan Semua Absen
  const cleanAllAbsen = async () => {
    if (!confirm("🚨 PERINGATAN! Seluruh data absen pengajar dari awal sampai akhir akan musnah. Yakin ingin mengosongkan database?")) return;
    setLoadingType("absen");
    try {
      // Trik hapus semua data di Supabase (Cari ID yang tidak kosong)
      const { error } = await supabase.from("attendances").delete().not("id", "is", null);
      if (error) throw error;
      toast.success("Ledakan sukses! Semua data absen telah dibersihkan.");
      setIsOpen(false);
    } catch (err: any) {
      toast.error("Gagal membersihkan", { description: err.message });
    } finally {
      setLoadingType(null);
    }
  };

  // 2. FUNGSI VACUUM: Bersihkan Gambar Saja
  const cleanImages = async () => {
    if (!confirm("Yakin ingin menghapus semua FOTO BUKTI absen? Tenang, data teks absen dan rekapan gaji akan tetap aman.")) return;
    setLoadingType("image");
    try {
      // Cari semua data yang punya foto
      const { data, error: fetchErr } = await supabase.from("attendances").select("id, photo_paths").not("photo_paths", "is", null);
      if (fetchErr) throw fetchErr;

      const allPaths: string[] = [];
      data.forEach(row => {
        if (row.photo_paths && row.photo_paths.length > 0) {
          allPaths.push(...row.photo_paths);
        }
      });

      if (allPaths.length > 0) {
        // Hapus file fisik dari Storage
        const { error: rmErr } = await supabase.storage.from("attendance-docs").remove(allPaths);
        if (rmErr) throw rmErr;
        
        // Kosongkan nama file di Database
        await supabase.from("attendances").update({ photo_paths: [] }).not("id", "is", null);
      }
      toast.success("Storage lega! Semua foto telah divakum dari server.");
    } catch (err: any) {
      toast.error("Gagal menghapus gambar", { description: err.message });
    } finally {
      setLoadingType(null);
    }
  };

  // 3. FUNGSI SAPU LIDI: Bersihkan Log & Absen Lama (> 30 Hari)
  const cleanLogs = async () => {
    if (!confirm("Data absen dan log aktivitas yang usianya LEBIH DARI 30 HARI akan dihapus permanen. Lanjutkan?")) return;
    setLoadingType("log");
    try {
      const lastMonth = new Date();
      lastMonth.setDate(lastMonth.getDate() - 30); // Tarik mundur 30 hari
      
      const { error } = await supabase.from("attendances").delete().lt("tanggal", lastMonth.toISOString());
      if (error) throw error;
      
      toast.success("Sapu bersih selesai! Data dan log bulan lalu sudah dihapus.");
    } catch (err: any) {
      toast.error("Gagal menyapu log", { description: err.message });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* Tombol Ikon Server */}
        <button 
          className="p-1.5 ml-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
          title="Manajemen Server & Database"
        >
          <Server className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Server & Database Manager
          </DialogTitle>
          <DialogDescription>
            Pilih tindakan pembersihan ruang penyimpanan server. <b>Hati-hati</b>, tindakan ini tidak dapat dikembalikan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          <Button 
            variant="outline" 
            className="justify-start border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
            onClick={cleanImages}
            disabled={loadingType !== null}
          >
            {loadingType === "image" ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <ImageMinus className="w-4 h-4 mr-3" />}
            Bersihkan Foto & Dokumen Saja (Aman)
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
            onClick={cleanLogs}
            disabled={loadingType !== null}
          >
            {loadingType === "log" ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <History className="w-4 h-4 mr-3" />}
            Bersihkan Log & Absen Lama (&gt; 30 Hari)
          </Button>

          <Button 
            variant="destructive" 
            className="justify-start mt-4 bg-destructive hover:bg-destructive/90"
            onClick={cleanAllAbsen}
            disabled={loadingType !== null}
          >
            {loadingType === "absen" ? <Loader2 className="w-4 h-4 mr-3 animate-spin text-white" /> : <Database className="w-4 h-4 mr-3" />}
            KOSONGKAN SEMUA DATA ABSEN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}