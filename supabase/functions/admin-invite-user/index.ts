import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
) as Record<string, string>;
const publishableKeys = JSON.parse(
  Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}",
) as Record<string, string>;
const serverKey =
  secretKeys.default ||
  Object.values(secretKeys)[0] ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const clientKey =
  publishableKeys.default ||
  Object.values(publishableKeys)[0] ||
  Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "",
    site = Deno.env.get("SITE_URL") || "";
  const headers = {
    "Access-Control-Allow-Origin": site,
    "Access-Control-Allow-Headers":
      "authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    Response.json(value, { status, headers });
  if (!site)
    return reply({ error: "Falta configurar SITE_URL en Edge Functions" }, 503);
  if (origin && origin !== site)
    return reply({ error: "Origen no permitido" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "Método no permitido" }, 405);
  let invitation: string | null = null;
  try {
    const token = (req.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    const { data: identity, error: authError } =
      await admin.auth.getUser(token);
    if (authError || !identity.user)
      return reply({ error: "Sesión inválida" }, 401);
    const user = createClient(url, clientKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await user
      .from("profiles")
      .select("active,access_level")
      .eq("id", identity.user.id)
      .single();
    if (
      profileError ||
      !profile.active ||
      profile.access_level !== "super_admin"
    )
      return reply(
        { error: "Sólo Andes Solutions puede invitar usuarios" },
        403,
      );
    const raw = await req.text();
    if (raw.length > 10000)
      return reply({ error: "Solicitud demasiado grande" }, 413);
    const payload = JSON.parse(raw);
    if (
      typeof payload.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(payload.email) ||
      typeof payload.full_name !== "string" ||
      !payload.full_name.trim()
    )
      return reply({ error: "Completá nombre y email válidos" }, 400);
    const { data: slot, error: slotError } = await user.rpc(
      "reserve_invitation",
      { payload },
    );
    if (slotError) throw slotError;
    invitation = slot;
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(
        payload.email.trim().toLowerCase(),
        { redirectTo: site + "/?recovery=1" },
      );
    if (inviteError) {
      await admin.rpc("finish_invitation", { invitation, invited_user: null });
      invitation = null;
      throw inviteError;
    }
    const { error: finishError } = await admin.rpc("finish_invitation", {
      invitation,
      invited_user: invited.user.id,
    });
    if (finishError)
      return reply(
        {
          error:
            "La invitación se envió, pero el perfil requiere revisión de Andes Solutions. Referencia: " +
            invitation,
        },
        503,
      );
    return reply({ ok: true });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : (error as { message?: string })?.message ||
              "No se pudo enviar la invitación",
      },
      400,
    );
  }
});
