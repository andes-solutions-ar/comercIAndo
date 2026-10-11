import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const secretKeys = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
) as Record<string, string>;
const serverKey =
  secretKeys.default ||
  Object.values(secretKeys)[0] ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(async (req: Request) => {
  const site = Deno.env.get("SITE_URL") || "",
    origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": site,
    "Access-Control-Allow-Headers":
      "authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    Response.json(value, { status, headers });
  if (!site) return reply({ error: "Falta configurar SITE_URL" }, 503);
  if (origin && origin !== site)
    return reply({ error: "Origen no permitido" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "Método no permitido" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 20000)
      return reply({ error: "Pedido demasiado grande" }, 413);
    const payload = JSON.parse(raw);
    if (
      !/^[0-9a-f-]{36}$/i.test(payload.request_id) ||
      typeof payload.customer_name !== "string" ||
      !payload.customer_name.trim() ||
      !Array.isArray(payload.items) ||
      !payload.items.length ||
      payload.items.length > 100 ||
      payload.items.some(
        (i: { quantity: number }) =>
          !Number.isInteger(i.quantity) || i.quantity <= 0,
      )
    )
      return reply({ error: "Pedido inválido" }, 400);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(ip + serverKey),
    );
    const rate_key = Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const { error: rateError } = await admin.rpc("check_order_rate", {
      rate_key,
    });
    if (rateError)
      return reply({ error: "Demasiados pedidos. Intentá más tarde" }, 429);
    const { data, error } = await admin.rpc("create_web_order", { payload });
    if (error) return reply({ error: error.message }, 400);
    return reply({ reference: data });
  } catch {
    return reply({ error: "No se pudo procesar el pedido" }, 400);
  }
});
