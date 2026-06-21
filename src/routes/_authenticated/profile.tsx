import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, UserCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Edit Profil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // State untuk nyimpen ketikan form
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Narik data terbaru dari database (biar formnya langsung keisi)
  const { isLoading: isFetching } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user!.id)
        .single();
      
      if (error) throw error;
      
      // Isi otomatis kolom input dengan data saat ini
      if (data) {
        setName(data.full_name || "");
        setUsername(data.username || "");
      }
      return data;
    },
  });

  // Fungsi simpan perubahan
  const updateMut = useMutation({
    mutationFn: async () => {
      // 1. Update data profil (nama & username)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ 
          full_name: name.trim(), 
          // Pastikan username otomatis huruf kecil dan tanpa spasi
          username: username.trim().toLowerCase().replace(/\s/g, '') 
        })
        .eq("id", user!.id);
      
      if (profErr) {
         // Cek kalau errornya karena username udah dipakai orang lain
         if (profErr.code === '23505') throw new Error("Username ini sudah dipakai pengajar lain.");
         throw profErr;
      }

      // 2. Update password JIKA diisi
      if (password.trim().length > 0) {
        const { error: passErr } = await supabase.auth.updateUser({
          password: password.trim()
        });
        if (passErr) throw passErr;
      }
    },
    onSuccess: () => {
      toast.success("Profil berhasil diperbarui!");
      setPassword(""); // Kosongkan form password biar aman
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (err: any) => {
      toast.error("Gagal update", { description: err.message });
    }
  });

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-10">
      {/* Tombol Kembali & Judul */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Pengaturan Akun</h1>
          <p className="text-sm text-muted-foreground">Sesuaikan data diri dan akses login Anda.</p>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="bg-muted/20 border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" /> Data Profil
          </CardTitle>
          <CardDescription>
            Username ini yang digunakan saat login. Harap diingat jika Anda mengubahnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isFetching ? (
            <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <form 
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                updateMut.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} 
                  required 
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="pass">Ganti Password (opsional)</Label>
                <Input 
                  id="pass" 
                  type="password" 
                  placeholder="Kosongkan jika tidak ingin diubah" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Minimal 6 karakter.</p>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Simpan Perubahan"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}