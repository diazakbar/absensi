import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/absensi")({
  head: () => ({ meta: [{ title: "Admin · Semua Absensi" }] }),
  component: AdminAllAttendancesPage,
});

function AdminAllAttendancesPage() {
  const today = new Date();
  const defaultFrom = format(
    new Date(today.getFullYear(), today.getMonth(), 1),
    "yyyy-MM-dd",
  );
  const defaultTo = format(today, "yyyy-MM-dd");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [schoolId, setSchoolId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );
  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s.name])),
    [schools],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["all-attendances", from, to, schoolId, userId],
    queryFn: async () => {
      let q = supabase
        .from("attendances")
        .select(
          "id, tanggal, sesi, materi, anak, bawa_kendaraan, school_id, user_id, custom_school_name",
        )
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) q = q.gte("tanggal", from);
      if (to) q = q.lte("tanggal", to);
      if (schoolId !== "all") q = q.eq("school_id", schoolId);
      if (userId !== "all") q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Semua Absensi</h2>
        <p className="text-sm text-muted-foreground">
          Rekap global semua pengajar (tanpa foto). Buka per pengajar untuk
          melihat bukti foto.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Pengajar</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua pengajar</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sekolah</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua sekolah</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {isLoading ? "Memuat..." : `${rows.length} entri`}
      </p>

      {!isLoading && rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada absen pada filter ini.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="transition-colors hover:bg-accent/40">
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {format(new Date(r.tanggal), "d MMM yyyy", {
                        locale: idLocale,
                      })}
                    </span>
                    <Badge variant="secondary">Sesi {r.sesi}</Badge>
                    <Link
                      to="/admin/pengajar/$id"
                      params={{ id: r.user_id }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {profileMap[r.user_id] ?? "—"}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      · {r.school_id ? (schoolMap[r.school_id] ?? "—") : (r.custom_school_name ?? "—")}
                      {!r.school_id && r.custom_school_name && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          (lainnya)
                        </span>
                      )}
                    </span>
                  </div>
                  {r.bawa_kendaraan && (
                    <Badge variant="outline" className="text-[10px]">
                      Bawa kendaraan
                    </Badge>
                  )}
                </div>
                {r.anak && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Anak: {r.anak}
                  </p>
                )}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {r.materi}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
