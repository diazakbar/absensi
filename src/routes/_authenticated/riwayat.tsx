import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { ChevronRight, FileText, Trash2 } from "lucide-react";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/riwayat")({
  head: () => ({ meta: [{ title: "Riwayat — Absen Pengajar" }] }),
  component: RiwayatPage,
});

function RiwayatPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [schoolId, setSchoolId] = useState<string>("all");
  const [sesi, setSesi] = useState<string>("all");

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s.name])),
    [schools],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-attendances", user?.id, from, to, schoolId, sesi],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("attendances")
        .select("id, tanggal, school_id, sesi, materi, anak, photo_paths")
        .eq("user_id", user!.id)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (from) q = q.gte("tanggal", from);
      if (to) q = q.lte("tanggal", to);
      if (schoolId !== "all") q = q.eq("school_id", schoolId);
      if (sesi !== "all") q = q.eq("sesi", Number(sesi));
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riwayat Absen</h1>
        <p className="text-sm text-muted-foreground">
          Daftar absen yang sudah kamu kirim.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Dari</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sekolah</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sesi</Label>
            <Select value={sesi} onValueChange={setSesi}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="1">Sesi 1</SelectItem>
                <SelectItem value="2">Sesi 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Memuat...</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada absen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-2 py-4">
                <Link
                  to="/riwayat/$id"
                  params={{ id: r.id }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(new Date(r.tanggal), "EEE, d MMM yyyy", {
                          locale: idLocale,
                        })}
                      </span>
                      <Badge variant="secondary">Sesi {r.sesi}</Badge>
                      {r.photo_paths?.length > 0 && (
                        <Badge variant="outline">{r.photo_paths.length} foto</Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {(r.school_id ? schoolMap[r.school_id] : null) ?? "—"} · {r.materi}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                <DeleteOwnAttendanceButton
                  attendanceId={r.id}
                  photoPaths={r.photo_paths ?? []}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Outlet />
    </div>
  );
}

function DeleteOwnAttendanceButton({
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
      qc.invalidateQueries({ queryKey: ["my-attendances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          title="Hapus absen"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus absen ini?</AlertDialogTitle>
          <AlertDialogDescription>
            Data absen beserta foto buktinya akan dihapus permanen.
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
