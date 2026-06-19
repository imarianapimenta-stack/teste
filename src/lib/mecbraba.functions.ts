import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// All sensitive DB access goes through these server functions using the
// service-role client. Clients never touch app_users directly.

const usernameSchema = z.string().trim().min(1).max(64);
const passwordSchema = z.string().min(1).max(200);
const roleSchema = z.enum(["admin", "mecanico"]);
const birthdaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const displayIdSchema = z.string().trim().max(60).nullable().optional();

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function hash(pwd: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(pwd, 10);
}
async function verify(pwd: string, hashed: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(pwd, hashed);
}

type SafeUser = { id: string; username: string; role: "admin" | "mecanico"; status: "approved" | "pending"; display_id: string | null };

async function requireAdmin(token: string): Promise<SafeUser> {
  const user = await resolveSessionUser(token);
  if (!user || user.role !== "admin" || user.status !== "approved") {
    throw new Error("Não autorizado");
  }
  return user;
}

async function resolveSessionUser(token: string): Promise<SafeUser | null> {
  if (!token) return null;
  const db = await getAdmin();
  const { data: session } = await db
    .from("app_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.from("app_sessions").delete().eq("token", token);
    return null;
  }
  const { data: user } = await db
    .from("app_users")
    .select("id, username, role, status, display_id")
    .eq("id", session.user_id)
    .maybeSingle();
  return (user as SafeUser) ?? null;
}

// ---- Public auth ----

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) =>
    z.object({ username: usernameSchema, password: passwordSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const { data: user } = await db
      .from("app_users")
      .select("id, username, password, role, status, display_id")
      .ilike("username", data.username)
      .maybeSingle();
    if (!user) return { error: "Usuário ou senha incorretos" as const };
    const ok = await verify(data.password, user.password);
    if (!ok) return { error: "Usuário ou senha incorretos" as const };
    if (user.status === "pending") return { error: "Conta pendente de aprovação pelo Admin" as const };
    const { data: session, error } = await db
      .from("app_sessions")
      .insert({ user_id: user.id })
      .select("token")
      .single();
    if (error || !session) return { error: "Erro ao iniciar sessão" as const };
    return {
      token: session.token as string,
      user: { id: user.id, username: user.username, role: user.role, status: user.status, display_id: user.display_id ?? null } as SafeUser,
    };
  });

export const registerFn = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string; birthday?: string | null; display_id?: string | null }) =>
    z.object({
      username: usernameSchema,
      password: passwordSchema,
      birthday: birthdaySchema,
      display_id: displayIdSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const { data: existing } = await db
      .from("app_users")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (existing) return { error: "Usuário já existe" as const };
    const hashed = await hash(data.password);
    const { error } = await db
      .from("app_users")
      .insert({
        username: data.username,
        password: hashed,
        role: "mecanico",
        status: "pending",
        birthday: data.birthday ?? null,
        display_id: data.display_id?.trim() ? data.display_id.trim() : null,
      });
    if (error) return { error: "Erro ao registrar" as const };
    return { ok: true as const };
  });

export const meFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await resolveSessionUser(data.token);
    return { user };
  });

export const logoutFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const db = await getAdmin();
    await db.from("app_sessions").delete().eq("token", data.token);
    return { ok: true as const };
  });

// ---- Admin operations ----

export const listUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const { data: users } = await db
      .from("app_users")
      .select("id, username, role, status, created_at, birthday, display_id")
      .order("created_at", { ascending: true });
    return { users: (users ?? []) };
  });

export const listBirthdaysFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const u = await resolveSessionUser(data.token);
    if (!u || u.status !== "approved") throw new Error("Não autorizado");
    const db = await getAdmin();
    const { data: users } = await db
      .from("app_users")
      .select("id, username, birthday, display_id")
      .eq("status", "approved");
    return { users: (users ?? []) as Array<{ id: string; username: string; birthday: string | null; display_id: string | null }> };
  });

export const approveUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    await db.from("app_users").update({ status: "approved" }).eq("id", data.id);
    return { ok: true as const };
  });

export const rejectUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    await db.from("app_users").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const removeUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.token);
    if (admin.id === data.id) return { error: "Você não pode apagar seu próprio perfil" as const };
    const db = await getAdmin();
    const { data: target } = await db.from("app_users").select("role, status").eq("id", data.id).maybeSingle();
    if (target?.role === "admin" && target.status === "approved") {
      const { count } = await db
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "approved");
      if ((count ?? 0) <= 1) return { error: "Deve existir pelo menos um Admin" as const };
    }
    await db.from("app_users").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const updateUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; username: string; role: "admin" | "mecanico"; birthday?: string | null; display_id?: string | null }) =>
    z.object({
      token: z.string(),
      id: z.string().uuid(),
      username: usernameSchema,
      role: roleSchema,
      birthday: birthdaySchema,
      display_id: displayIdSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const { data: existing } = await db
      .from("app_users")
      .select("id")
      .ilike("username", data.username)
      .neq("id", data.id)
      .maybeSingle();
    if (existing) return { error: "Usuário já existe" as const };
    if (data.role !== "admin") {
      const { data: target } = await db.from("app_users").select("role").eq("id", data.id).maybeSingle();
      if (target?.role === "admin") {
        const { count } = await db
          .from("app_users")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("status", "approved");
        if ((count ?? 0) <= 1) return { error: "Deve existir pelo menos um Admin" as const };
      }
    }
    await db.from("app_users").update({
      username: data.username,
      role: data.role,
      birthday: data.birthday ?? null,
      display_id: data.display_id?.trim() ? data.display_id.trim() : null,
    }).eq("id", data.id);
    return { ok: true as const };
  });

export const saveQuickTabsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; tabs: string[] }) =>
    z.object({
      token: z.string(),
      tabs: z.array(z.string().min(1).max(40)).max(20),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = await resolveSessionUser(data.token);
    if (!u || u.status !== "approved") throw new Error("Não autorizado");
    const db = await getAdmin();
    await db.from("app_users").update({ quick_tabs: data.tabs }).eq("id", u.id);
    return { ok: true as const };
  });

export const getQuickTabsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const u = await resolveSessionUser(data.token);
    if (!u || u.status !== "approved") throw new Error("Não autorizado");
    const db = await getAdmin();
    const { data: row } = await db.from("app_users").select("quick_tabs").eq("id", u.id).maybeSingle();
    const tabs = Array.isArray(row?.quick_tabs) ? (row!.quick_tabs as string[]) : null;
    return { tabs };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; password: string }) =>
    z.object({ token: z.string(), id: z.string().uuid(), password: passwordSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const hashed = await hash(data.password);
    await db.from("app_users").update({ password: hashed }).eq("id", data.id);
    // invalidate any active sessions for this user
    await db.from("app_sessions").delete().eq("user_id", data.id);
    return { ok: true as const };
  });

export const saveConfigFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; data: Record<string, unknown> }) =>
    z.object({ token: z.string(), data: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db
      .from("app_config")
      .upsert({ id: 1, data: data.data as any, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---- Announcements ----

export const listAnnouncementsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireUser(data.token);
    const db = await getAdmin();
    const { data: rows } = await db
      .from("app_announcements")
      .select("id, title, body, created_at, expires_at")
      .order("created_at", { ascending: false });
    const now = Date.now();
    const items = (rows ?? []).filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > now);
    return { items };
  });

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; title: string; body: string; expires_at: string | null }) =>
    z.object({
      token: z.string(),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(4000),
      expires_at: z.string().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const { error } = await db.from("app_announcements").insert({
      title: data.title,
      body: data.body,
      expires_at: data.expires_at,
    });
    if (error) return { error: "Erro ao criar comunicado" as const };
    return { ok: true as const };
  });

export const deleteAnnouncementFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    await db.from("app_announcements").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Time clock ----

export const clockPunchFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await resolveSessionUser(data.token);
    if (!user) throw new Error("Não autorizado");
    const db = await getAdmin();
    const { data: open } = await db
      .from("app_timeclock")
      .select("id")
      .eq("user_id", user.id)
      .is("exit_at", null)
      .order("entry_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open) {
      await db.from("app_timeclock").update({ exit_at: new Date().toISOString() }).eq("id", open.id);
      return { action: "out" as const };
    }
    await db.from("app_timeclock").insert({ user_id: user.id });
    return { action: "in" as const };
  });

export const listMyTimeclockFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await resolveSessionUser(data.token);
    if (!user) throw new Error("Não autorizado");
    const db = await getAdmin();
    const { data: rows } = await db
      .from("app_timeclock")
      .select("id, entry_at, exit_at")
      .eq("user_id", user.id)
      .order("entry_at", { ascending: false })
      .limit(100);
    return { items: rows ?? [] };
  });

export const listAllTimeclockFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const { data: rows } = await db
      .from("app_timeclock")
      .select("id, user_id, entry_at, exit_at")
      .order("entry_at", { ascending: false })
      .limit(500);
    const { data: users } = await db.from("app_users").select("id, username, display_id");
    const map = new Map((users ?? []).map((u) => [u.id, { username: u.username, display_id: u.display_id ?? null }]));
    return {
      items: (rows ?? []).map((r) => {
        const u = map.get(r.user_id);
        return { ...r, username: u?.username ?? "—", display_id: u?.display_id ?? null };
      }),
    };
  });

// ---- Clientes ----

const nomeSchema = z.string().trim().min(1).max(120);
const passaporteSchema = z.string().trim().min(1).max(60);
const celularSchema = z.string().trim().max(40).nullable().optional();

async function requireUser(token: string): Promise<SafeUser> {
  const u = await resolveSessionUser(token);
  if (!u || u.status !== "approved") throw new Error("Não autorizado");
  return u;
}

const BRABO_DAYS = 30;
function braboExpiryFromNow(): string {
  return new Date(Date.now() + BRABO_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export const listClientesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; q?: string }) =>
    z.object({ token: z.string(), q: z.string().trim().max(120).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUser(data.token);
    const db = await getAdmin();
    let query = db
      .from("app_clientes")
      .select("id, nome, id_passaporte, celular, cliente_brabo, cliente_brabo_expira, criado_por, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.q && data.q.length > 0) {
      const term = `%${data.q.replace(/[%_]/g, "")}%`;
      query = query.or(`nome.ilike.${term},id_passaporte.ilike.${term}`);
    }
    const { data: rows } = await query;
    const { data: users } = await db.from("app_users").select("id, username, display_id");
    const map = new Map((users ?? []).map((u) => [u.id, { username: u.username, display_id: u.display_id ?? null }]));
    const now = Date.now();
    const items = (rows ?? []).map((r) => {
      const expira = (r as { cliente_brabo_expira: string | null }).cliente_brabo_expira;
      const active = !!r.cliente_brabo && !!expira && new Date(expira).getTime() > now;
      const u = map.get(r.criado_por);
      return {
        ...r,
        cliente_brabo: active,
        cliente_brabo_expira: expira,
        criado_por_username: u?.username ?? "—",
        criado_por_display_id: u?.display_id ?? null,
      };
    });
    return { items };
  });

export const createClienteFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; nome: string; id_passaporte: string; celular?: string | null; cliente_brabo: boolean }) =>
    z.object({
      token: z.string(),
      nome: nomeSchema,
      id_passaporte: passaporteSchema,
      celular: celularSchema,
      cliente_brabo: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getAdmin();
    const { error } = await db.from("app_clientes").insert({
      nome: data.nome,
      id_passaporte: data.id_passaporte,
      celular: data.celular ?? null,
      cliente_brabo: data.cliente_brabo,
      cliente_brabo_expira: data.cliente_brabo ? braboExpiryFromNow() : null,
      criado_por: user.id,
    });
    if (error) return { error: "Erro ao registrar cliente" as const };
    return { ok: true as const };
  });

export const updateClienteFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; nome: string; id_passaporte: string; celular?: string | null; cliente_brabo: boolean; cliente_brabo_expira?: string | null }) =>
    z.object({
      token: z.string(),
      id: z.string().uuid(),
      nome: nomeSchema,
      id_passaporte: passaporteSchema,
      celular: celularSchema,
      cliente_brabo: z.boolean(),
      cliente_brabo_expira: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const editor = await requireUser(data.token);
    const db = await getAdmin();
    const { data: current } = await db
      .from("app_clientes")
      .select("nome, id_passaporte, celular, cliente_brabo, cliente_brabo_expira")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) return { error: "Cliente não encontrado" as const };

    const now = Date.now();
    const currentActive =
      !!current.cliente_brabo &&
      !!current.cliente_brabo_expira &&
      new Date(current.cliente_brabo_expira).getTime() > now;
    let expira: string | null = null;
    if (data.cliente_brabo) {
      if (data.cliente_brabo_expira !== undefined && data.cliente_brabo_expira !== null && data.cliente_brabo_expira !== "") {
        expira = new Date(data.cliente_brabo_expira).toISOString();
      } else {
        expira = currentActive ? (current.cliente_brabo_expira as string) : braboExpiryFromNow();
      }
    }

    const { error } = await db
      .from("app_clientes")
      .update({
        nome: data.nome,
        id_passaporte: data.id_passaporte,
        celular: data.celular ?? null,
        cliente_brabo: data.cliente_brabo,
        cliente_brabo_expira: expira,
      })
      .eq("id", data.id);
    if (error) return { error: "Erro ao atualizar cliente" as const };

    type Field = "nome" | "id_passaporte" | "celular" | "cliente_brabo" | "cliente_brabo_expira";
    const norm = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const pairs: Array<[Field, unknown, unknown]> = [
      ["nome", current.nome, data.nome],
      ["id_passaporte", current.id_passaporte, data.id_passaporte],
      ["celular", current.celular ?? null, data.celular ?? null],
      ["cliente_brabo", current.cliente_brabo, data.cliente_brabo],
      ["cliente_brabo_expira", current.cliente_brabo_expira, expira],
    ];
    const changes = pairs
      .filter(([, o, n]) => norm(o) !== norm(n))
      .map(([field, o, n]) => ({
        cliente_id: data.id,
        cliente_nome: data.nome,
        editor_id: editor.id,
        editor_username: editor.username,
        field,
        old_value: norm(o),
        new_value: norm(n),
      }));
    if (changes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("app_cliente_logs").insert(changes);
    }
    return { ok: true as const };
  });

export const listClienteLogsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; cliente_id?: string }) =>
    z.object({ token: z.string(), cliente_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (db as any)
      .from("app_cliente_logs")
      .select("id, cliente_id, cliente_nome, editor_id, editor_username, field, old_value, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.cliente_id) query = query.eq("cliente_id", data.cliente_id);
    const { data: rows } = await query;
    return { items: (rows ?? []) as Array<{ id: string; cliente_id: string; cliente_nome: string; editor_id: string; editor_username: string; field: string; old_value: string | null; new_value: string | null; created_at: string }> };
  });

export const renewClienteBraboFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUser(data.token);
    const db = await getAdmin();
    const { error } = await db
      .from("app_clientes")
      .update({
        cliente_brabo: true,
        cliente_brabo_expira: braboExpiryFromNow(),
      })
      .eq("id", data.id);
    if (error) return { error: "Erro ao renovar Cliente Brabo" as const };
    return { ok: true as const };
  });

export const deleteClienteFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    await db.from("app_clientes").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Sugestões ----

const sugestaoStatusSchema = z.enum(["nova", "vista", "em_analise", "concluida"]);
const mensagemSchema = z.string().trim().min(1).max(2000);

export const listSugestoesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (db as any)
      .from("app_sugestoes")
      .select("id, user_id, username, mensagem, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (user.role !== "admin") query = query.eq("user_id", user.id);
    const { data: rows } = await query;
    const { data: users } = await db.from("app_users").select("id, display_id");
    const map = new Map((users ?? []).map((u: { id: string; display_id: string | null }) => [u.id, u.display_id ?? null]));
    const items = (rows ?? []).map((r: { id: string; user_id: string; username: string; mensagem: string; status: string; created_at: string }) => ({
      ...r,
      display_id: map.get(r.user_id) ?? null,
    }));
    return { items: items as Array<{
      id: string; user_id: string; username: string; mensagem: string; status: string; created_at: string; display_id: string | null;
    }> };
  });

export const createSugestaoFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; mensagem: string }) =>
    z.object({ token: z.string(), mensagem: mensagemSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).from("app_sugestoes").insert({
      user_id: user.id,
      username: user.username,
      mensagem: data.mensagem,
      status: "nova",
    });
    if (error) return { error: "Erro ao enviar sugestão" as const };
    return { ok: true as const };
  });

export const updateSugestaoStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; status: "nova" | "vista" | "em_analise" | "concluida" }) =>
    z.object({ token: z.string(), id: z.string().uuid(), status: sugestaoStatusSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("app_sugestoes").update({ status: data.status }).eq("id", data.id);
    return { ok: true as const };
  });

export const deleteSugestaoFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getAdmin();
    if (user.role !== "admin") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (db as any)
        .from("app_sugestoes").select("user_id").eq("id", data.id).maybeSingle();
      if (!row || row.user_id !== user.id) return { error: "Não autorizado" as const };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("app_sugestoes").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Change Logs ----

const changelogTitleSchema = z.string().trim().min(1).max(200);
const changelogDescSchema = z.string().trim().min(1).max(4000);
const changelogDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listChangelogsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireUser(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (db as any)
      .from("app_changelogs")
      .select("id, titulo, descricao, data, created_at")
      .order("data", { ascending: false })
      .limit(500);
    return { items: (rows ?? []) as Array<{ id: string; titulo: string; descricao: string; data: string; created_at: string }> };
  });

export const createChangelogFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; titulo: string; descricao: string; data: string }) =>
    z.object({ token: z.string(), titulo: changelogTitleSchema, descricao: changelogDescSchema, data: changelogDateSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).from("app_changelogs").insert({
      titulo: data.titulo,
      descricao: data.descricao,
      data: data.data,
    });
    if (error) return { error: "Erro ao criar entrada" as const };
    return { ok: true as const };
  });

export const deleteChangelogFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("app_changelogs").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Open timeclock (who is currently working) ----

export const listOpenTimeclockFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireUser(data.token);
    const db = await getAdmin();
    const { data: rows } = await db
      .from("app_timeclock")
      .select("id, user_id, entry_at")
      .is("exit_at", null)
      .order("entry_at", { ascending: false })
      .limit(200);
    if (!rows || rows.length === 0) return { items: [] as Array<{ id: string; user_id: string; entry_at: string; username: string; display_id: string | null }> };
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: users } = await db.from("app_users").select("id, username, display_id").in("id", ids);
    const map = new Map((users ?? []).map((u) => [u.id, { username: u.username, display_id: u.display_id ?? null }]));
    const seen = new Set<string>();
    const items = [] as Array<{ id: string; user_id: string; entry_at: string; username: string; display_id: string | null }>;
    for (const r of rows) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const u = map.get(r.user_id);
      items.push({ id: r.id, user_id: r.user_id, entry_at: r.entry_at, username: u?.username ?? "—", display_id: u?.display_id ?? null });
    }
    return { items };
  });

// ---- Music track upload (Admin only) ----
// Receives base64-encoded audio, uploads to private "music" bucket,
// and returns a long-lived signed URL the browser can stream.
export const uploadMusicTrackFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; filename: string; contentType: string; base64: string }) =>
    z
      .object({
        token: z.string(),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const db = await getAdmin();
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const path = `tracks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const bytes = Buffer.from(data.base64, "base64");
    const { error: upErr } = await db.storage
      .from("music")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) return { error: `Erro no upload: ${upErr.message}` as const };
    // ~10 years
    const { data: signed, error: sErr } = await db.storage
      .from("music")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed?.signedUrl) {
      await db.storage.from("music").remove([path]).catch(() => {});
      return { error: "Erro ao gerar URL do áudio" as const };
    }
    return { ok: true as const, url: signed.signedUrl, path };
  });

