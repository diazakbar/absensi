import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    const pMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        { full_name: p.full_name, username: p.username },
      ]),
    );
    const rMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rMap.set(r.user_id, arr);
    }
    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: pMap.get(u.id)?.full_name ?? "",
      username: pMap.get(u.id)?.username ?? "",
      roles: rMap.get(u.id) ?? [],
      created_at: u.created_at,
    }));
  });

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  is_admin: z.boolean().optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        ...(data.username ? { username: data.username } : {}),
      },
    });
    if (error) throw new Error(error.message);
    if (data.username && created.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ username: data.username })
        .eq("id", created.user.id);
    }
    if (data.is_admin && created.user) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" });
    }
    return { id: created.user?.id };
  });

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .nullable()
    .optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  is_admin: z.boolean().optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const profileUpdate: { full_name?: string; username?: string | null } = {};
    if (data.full_name) profileUpdate.full_name = data.full_name;
    if (data.username !== undefined) profileUpdate.username = data.username;
    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    const authUpdate: { password?: string; email?: string } = {};
    if (data.password) authUpdate.password = data.password;
    if (data.email) authUpdate.email = data.email;
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        data.user_id,
        { ...authUpdate, email_confirm: true } as any,
      );
      if (error) throw new Error(error.message);
    }
    if (typeof data.is_admin === "boolean") {
      if (data.is_admin) {
        await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: data.user_id, role: "admin" },
            { onConflict: "user_id,role" },
          );
      } else {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.user_id)
          .eq("role", "admin");
      }
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if ((context as any).userId === data.user_id) {
      throw new Error("Tidak bisa menghapus akun sendiri");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: look up an email for username-based sign-in.
// Returns null if no user matches.
export const lookupEmailByUsername = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username.trim())
      .maybeSingle();
    if (!profile) return { email: null as string | null };
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(
      profile.id,
    );
    return { email: user.user?.email ?? null };
  });
