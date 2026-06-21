# Web Absen Pengajar

Pengganti Google Form supaya tiap pengajar bisa login, isi absen, dan melihat riwayat absennya sendiri. Admin mengelola pengguna dan daftar sekolah.

## Yang akan dibangun

### 1. Login

- Halaman `/auth` (username + password). Akun bisa dibuat sendiri/dibuatkan oleh admin. 
- Sesi tersimpan; akses ke halaman aplikasi butuh login.

### 2. Halaman absen (pengajar) — `/`

Form dengan field:

- Nama pengajar (otomatis dari akun login, read-only)
- Membawa kendaraan? (Ya / Tidak)
- Tanggal mengajar (date picker, default hari ini)
- Sekolah (dropdown dari data master yang dikelola admin)
- Nama anak yang diajarkan (ketik bebas, boleh lebih dari satu nama,boleh kosong)
- Sesi (1 atau 2)
- Materi ajar (textarea)
- Dokumentasi (upload foto, bisa lebih dari satu)

Setelah submit: notifikasi sukses + form ter-reset.

### 3. Halaman riwayat — `/riwayat`

- Daftar semua absen milik pengajar yang login (terbaru di atas).
- Filter: rentang tanggal, sekolah, sesi.
- Tiap baris bisa diklik untuk lihat detail lengkap + foto dokumentasi.
- Pengajar **tidak** bisa edit/hapus absen miliknya (menjaga integritas data, sama seperti GForm). Bisa diubah kalau diminta.

### 4. Panel admin — `/admin`

Hanya untuk user dengan role `admin`:

- **Kelola pengajar**: tambah (email + password awal + nama), edit nama/role, reset password, nonaktifkan/hapus.
- **Kelola sekolah**: tambah / edit / hapus sekolah yang kerja sama.
- **Lihat semua absen**: tabel semua absen seluruh pengajar dengan filter (pengajar, sekolah, tanggal, sesi) + ekspor CSV.
  &nbsp;

## Detail teknis

**Backend (Lovable Cloud):**

- Tabel `profiles` (id, full_name) — auto dibuat saat user dibuat via trigger.
- Tabel `user_roles` (user_id, role: `admin` | `pengajar`) — terpisah dari profiles, pakai fungsi `has_role()` SECURITY DEFINER untuk cek role di RLS.
- Tabel `schools` (id, name, active).
- Tabel `attendances` (id, user_id, tanggal, school_id, anak (text), sesi, materi, bawa_kendaraan, created_at).
- Tabel `attendance_photos` (id, attendance_id, storage_path) — atau kolom array di attendances.
- Storage bucket `attendance-docs` (private) untuk foto dokumentasi; URL diakses via signed URL.

**RLS:**

- `attendances`: pengajar SELECT/INSERT hanya untuk `user_id = auth.uid()`. Admin SELECT semua via `has_role(auth.uid(),'admin')`.
- `schools`: semua authenticated boleh SELECT; hanya admin INSERT/UPDATE/DELETE.
- `user_roles` & `profiles`: user lihat miliknya; admin kelola semua.

**Frontend (TanStack Start):**

- Route publik: `/auth`.
- Route terproteksi di `_authenticated/`: `/` (form absen), `/riwayat`, `/riwayat/$id`.
- Route admin di `_authenticated/admin/` dengan gate role `admin`.
- Validasi form pakai Zod + react-hook-form.
- Upload foto lewat Supabase Storage client; insert baris attendance + photo paths dalam satu alur.

**Akun admin pertama:** dibuat manual lewat seed/migration (email admin yang akan kamu kasih tahu) supaya kamu bisa langsung login dan menambah pengajar lain.

## Yang TIDAK termasuk (bisa ditambah nanti)

- Edit/hapus absen oleh pengajar
- Notifikasi email/WhatsApp
- Statistik/dashboard (total jam mengajar, dsb.)
- Ekspor PDF per pengajar