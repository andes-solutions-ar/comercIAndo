import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`,
  );
  for (const f of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).sort())
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + f, import.meta.url),
        "utf8",
      ),
    );
  const owner = randomUUID();
  await db.query("insert into auth.users values($1,$2)", [
    owner,
    "owner@example.test",
  ]);
  await db.query(
    "insert into profiles(id,full_name,access_level)values($1,'Owner','super_admin')",
    [owner],
  );
  await db.exec(`set request.jwt.claim.sub='${owner}';set role authenticated;`);
  return db;
}
async function call(db, name, params = {}) {
  const keys = Object.keys(params);
  return (
    await db.query(
      "select public." +
        name +
        "(" +
        keys.map((k, i) => k + "=> $" + (i + 1)).join(",") +
        ") result",
      keys.map((k) =>
        typeof params[k] === "object" ? JSON.stringify(params[k]) : params[k],
      ),
    )
  ).rows[0].result;
}
const productId = randomUUID();
async function seed(db) {
  let snap = await call(db, "remake_load");
  const p = [
    "Producto real",
    "General",
    1210,
    10,
    2,
    200,
    [],
    "▤",
    "#eef2ff",
    500,
    {
      id: productId,
      code: "ART-1",
      policy: "unlimited",
      status: "enabled",
      onlineUnits: 5,
      webReserved: 0,
      onlinePublished: true,
    },
  ];
  snap.state.products = [p];
  snap.state.categories = ["General"];
  snap.state.settings.storeOpen = true;
  snap.state.cashSessions = [
    { id: "J-1", branch: "Sucursal Centro", status: "open" },
  ];
  return call(db, "remake_commit", {
    expected_version: snap.version,
    request_id: randomUUID(),
    next_state: snap.state,
  });
}
test("remake: protected state, real persistence, idempotency, stale sessions and server-side sale checks", async () => {
  const db = await database();
  try {
    let snap = await seed(db),
      state = structuredClone(snap.state);
    state.settings.storeName = "Persistido";
    const id = randomUUID();
    let saved = await call(db, "remake_commit", {
      expected_version: snap.version,
      request_id: id,
      next_state: state,
    });
    assert.equal(saved.state.settings.storeName, "Persistido");
    assert.equal(
      (
        await call(db, "remake_commit", {
          expected_version: snap.version,
          request_id: id,
          next_state: state,
        })
      ).version,
      saved.version,
    );
    await assert.rejects(
      call(db, "remake_commit", {
        expected_version: snap.version,
        request_id: randomUUID(),
        next_state: state,
      }),
      /cambiaron/,
    );
    state = structuredClone(saved.state);
    state.products[0][3] = 9;
    state.sales = [
      [
        "#2000",
        "Cliente",
        "Mostrador",
        1210,
        "Efectivo",
        "Cobrada",
        "12:00",
        [{ productId, name: "Producto real", qty: 1, price: 1210 }],
        {},
        { discountAmount: 0 },
      ],
    ];
    state.payments = [["P-1", 2000, "Efectivo", 1210, "Aprobado"]];
    saved = await call(db, "remake_commit", {
      expected_version: saved.version,
      request_id: randomUUID(),
      next_state: state,
    });
    assert.equal(saved.state.products[0][3], 9);
    state = structuredClone(saved.state);
    state.sales[0][3] = 1;
    await assert.rejects(
      call(db, "remake_commit", {
        expected_version: saved.version,
        request_id: randomUUID(),
        next_state: state,
      }),
      /histórica/,
    );
    state = structuredClone(saved.state);
    state.products[0][3] = -1;
    await assert.rejects(
      call(db, "remake_commit", {
        expected_version: saved.version,
        request_id: randomUUID(),
        next_state: state,
      }),
      /inválido/,
    );
    const partial = randomUUID();
    await db.exec("reset role;");
    await db.query("insert into auth.users values($1,$2)", [
      partial,
      "partial@example.test",
    ]);
    await db.query(
      "insert into profiles(id,full_name,access_level,permissions) values($1,'Partial','admin',$2::jsonb)",
      [
        partial,
        JSON.stringify(
          Object.fromEntries(
            ["products", "stock", "sales", "payments", "settings", "users"].map(
              (k) => [k, true],
            ),
          ),
        ),
      ],
    );
    await db.exec(
      `set request.jwt.claim.sub='${partial}';set role authenticated;`,
    );
    await assert.rejects(call(db, "remake_load"), /acceso completo/);
    await db.exec("reset role;set role anon;");
    await assert.rejects(call(db, "remake_load"), /permission denied/);
    await assert.rejects(
      db.query("select * from remake_state"),
      /permission denied/,
    );
    const menu = await call(db, "remake_catalog");
    assert.equal(menu.products[0].name, "Producto real");
    assert.equal(menu.state, undefined);
    assert.equal(menu.customers, undefined);
    await assert.rejects(
      call(db, "remake_checkout", { payload: {} }),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("remake: web reservation, server price, safe tracking and idempotent order under concurrent snapshots", async () => {
  const db = await database();
  try {
    let snap = await seed(db);
    await db.exec("reset role;set role service_role;");
    const payload = {
      requestId: randomUUID(),
      token: randomUUID(),
      customer: { name: "Cliente real", phone: "1123456789" },
      delivery: "pickup",
      payment: "at_pickup",
      items: [{ id: productId, qty: 2, expectedPrice: 1210 }],
    };
    let result = await call(db, "remake_checkout", { payload });
    assert.equal(result.order.total, 2420);
    assert.match(result.order.deliveryCode, /^\d{6}$/);
    assert.equal(
      (await call(db, "remake_checkout", { payload })).order.number,
      result.order.number,
    );
    assert.equal(
      (
        await call(db, "remake_track", {
          order_number: result.order.number,
          tracking_token: payload.token,
        })
      ).order.total,
      2420,
    );
    await assert.rejects(
      call(db, "remake_track", {
        order_number: result.order.number,
        tracking_token: randomUUID(),
      }),
      /No encontramos/,
    );
    const bad = {
      ...payload,
      requestId: randomUUID(),
      items: [{ id: productId, qty: 2, expectedPrice: 1 }],
    };
    await assert.rejects(
      call(db, "remake_checkout", { payload: bad }),
      /precio/,
    );
    await db.exec("reset role;set role authenticated;");
    let fresh = await call(db, "remake_load");
    assert.equal(fresh.state.products[0][3], 10);
    assert.equal(fresh.state.products[0][10].onlineUnits, 3);
    assert.equal(fresh.state.products[0][10].webReserved, 2);
    await assert.rejects(
      call(db, "remake_commit", {
        expected_version: snap.version,
        request_id: randomUUID(),
        next_state: snap.state,
      }),
      /cambiaron/,
    );
    const forged = structuredClone(fresh.state);
    forged.orderFlow[0].paymentConfirmed = true;
    forged.orderFlow[0].status = "Entregado";
    await assert.rejects(
      call(db, "remake_commit", {
        expected_version: fresh.version,
        request_id: randomUUID(),
        next_state: forged,
      }),
      /cobro/,
    );
    const st = structuredClone(fresh.state);
    st.payments.push([
      "WEB-P",
      result.order.number,
      "Efectivo",
      2420,
      "Aprobado",
    ]);
    st.orderFlow[0].paymentConfirmed = true;
    st.orderFlow[0].status = "Entregado";
    st.orderFlow[0].deliveredAt = new Date().toISOString();
    fresh = await call(db, "remake_commit", {
      expected_version: fresh.version,
      request_id: randomUUID(),
      next_state: st,
    });
    assert.equal(fresh.state.products[0][3], 8);
    assert.equal(fresh.state.products[0][10].webReserved, 0);
    fresh = await call(db, "remake_commit", {
      expected_version: fresh.version,
      request_id: randomUUID(),
      next_state: fresh.state,
    });
    assert.equal(fresh.state.products[0][3], 8);
  } finally {
    await db.close();
  }
});
