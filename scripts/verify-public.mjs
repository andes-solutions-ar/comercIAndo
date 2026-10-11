import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) =>
      /^(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)=/.test(l),
    )
    .map((l) => {
      const at = l.indexOf("=");
      return [l.slice(0, at), l.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);
const url = env.VITE_SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth = await fetch(url + "/auth/v1/settings", {
  headers: { apikey: key },
});
const settings = await auth.json();
console.log(
  JSON.stringify({
    authStatus: auth.status,
    signupDisabled: settings.disable_signup,
    emailEnabled: settings.external?.email,
  }),
);
const catalog = await fetch(url + "/rest/v1/rpc/get_public_catalog", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
console.log(
  JSON.stringify({
    catalogStatus: catalog.status,
    catalog: await catalog.json(),
  }),
);
for (const table of [
  "profiles",
  "products",
  "sales",
  "payments",
  "app_settings",
]) {
  const r = await fetch(url + "/rest/v1/" + table + "?select=id&limit=1", {
    headers: { apikey: key },
  });
  console.log(JSON.stringify({ table, status: r.status }));
  if (r.ok) process.exitCode = 1;
}
const admin = await fetch(url + "/rest/v1/rpc/finish_invitation", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({
    invitation: "00000000-0000-0000-0000-000000000001",
    invited_user: null,
  }),
});
console.log(JSON.stringify({ privilegedRpcAnonymousStatus: admin.status }));
if (admin.ok) process.exitCode = 1;
for (const fn of process.env.APP_ORIGIN
  ? ["admin-invite-user", "create-web-order"]
  : []) {
  const r = await fetch(url + "/functions/v1/" + fn, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Origin: process.env.APP_ORIGIN,
    },
    body: "{}",
  });
  console.log(
    JSON.stringify({
      function: fn,
      status: r.status,
      response: await r.json(),
    }),
  );
}
