import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, KeyRound, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin · Pengajar" }] }),
  component: AdminUsersPage,
});

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

function AdminUsersPage() {
  const list = useServerFn(listUsers);
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Daftar Pengajar</h2>
        <CreateUserDialog onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRowCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRowCard({ user }: { user: UserRow }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteUser);
  const isAdmin = user.roles.includes("admin");

  const delMut = useMutation({
    mutationFn: () => del({ data: { user_id: user.id } }),
    onSuccess: () => {
      toast.success("Pengguna dihapus");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{user.full_name || "—"}</span>
            {isAdmin && <Badge>Admin</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {user.email}
            {user.username ? (
              <span className="ml-1 text-xs">· @{user.username}</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isAdmin && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/pengajar/$id" params={{ id: user.id }}>
                <Wallet className="mr-1 h-4 w-4" /> Absen & Gaji
              </Link>
            </Button>
          )}
          <EditUserDialog user={user} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Hapus">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus pengguna ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Akun {user.email} akan dihapus permanen beserta seluruh data
                  absen miliknya.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => delMut.mutate()}>
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const create = useServerFn(createUser);
  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          email,
          password,
          full_name: fullName,
          username: username.trim() || undefined,
          is_admin: isAdmin,
        },
      }),
    onSuccess: () => {
      toast.success("Pengguna dibuat");
      setOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setUsername("");
      setIsAdmin(false);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Tambah Pengajar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pengajar</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Nama Lengkap</Label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username (opsional, untuk login tanpa email)</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="huruf/angka, min 3 karakter"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password Awal</Label>
            <Input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => setIsAdmin(!!v)} />
            Jadikan admin
          </label>
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user }: { user: UserRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(user.roles.includes("admin"));
  const update = useServerFn(updateUser);

  const mut = useMutation({
    mutationFn: () =>
      update({
        data: {
          user_id: user.id,
          full_name: fullName,
          email: email !== user.email ? email : undefined,
          username:
            username.trim() === (user.username ?? "")
              ? undefined
              : username.trim() === ""
                ? null
                : username.trim(),
          is_admin: isAdmin,
          password: newPassword ? newPassword : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Tersimpan");
      setNewPassword("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pengajar</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Nama Lengkap</Label>
            <Input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Kosongkan untuk hapus"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> Password Baru (opsional)
            </Label>
            <Input
              type="text"
              placeholder="Kosongkan jika tidak diubah"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => setIsAdmin(!!v)} />
            Admin
          </label>
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
