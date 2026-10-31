import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { liteState, liteDocument } from "../src/remake/lite-model.js";

test("Emprendedores: accepted UI persists through the existing PostgreSQL contract without demo data", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
    );
    for (const file of readdirSync(
      new URL("../supabase/migrations/", import.meta.url),
    ).sort())
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const profile = { id: randomUUID(), full_name: "Administrador de prueba" };
    await db.query("insert into auth.users values($1,$2)", [
      profile.id,
      "test@example.test",
    ]);
    await db.query(
      "insert into profiles(id,full_name,access_level)values($1,$2,'super_admin')",
      [profile.id, profile.full_name],
    );
    await db.exec(
      `set request.jwt.claim.sub='${profile.id}';set role authenticated;`,
    );
    const load = async () =>
      (await db.query("select remake_load() result")).rows[0].result;
    let snap = await load();
    const commit = async (ui) => {
      const next = liteDocument(ui, snap.state, profile, randomUUID);
      snap = (
        await db.query("select remake_commit($1,$2,$3) result", [
          snap.version,
          randomUUID(),
          JSON.stringify(next),
        ])
      ).rows[0].result;
      return liteState(snap.state, [[profile.full_name]]);
    };
    let ui = liteState(snap.state);
    assert.equal(ui.products.length, 0);
    assert.equal(ui.sales.length, 0);
    assert.equal(ui.cash, false);
    ui.categories = ["General"];
    ui.products.push({
      id: 1,
      name: "Producto QA",
      cat: "General",
      cost: 500,
      price: 1000,
      stock: 10,
      min: 2,
      barcode: "7790000000001",
      published: false,
    });
    ui = await commit(ui);
    assert.equal(ui.products[0].stock, 10);
    assert.equal(ui.movements.length, 1);
    ui.cash = true;
    ui = await commit(ui);
    const saleId =
      "#" + (await db.query("select remake_next_number() n")).rows[0].n;
    ui.products[0].stock = 8;
    ui.sales.unshift({
      id: saleId,
      at: new Date().toISOString(),
      total: 1800,
      discount: 200,
      payment: "Transferencia",
      delivery: "Envío",
      customer: "Cliente QA",
      items: [{ id: 1, name: "Producto QA", qty: 2, price: 1000 }],
    });
    ui.deliveries.unshift({
      id: "P-" + randomUUID(),
      sale: saleId,
      customer: "Cliente QA",
      type: "Envío",
      address: "Dirección QA",
      status: "Pendiente",
    });
    ui = await commit(ui);
    const reloaded = liteState((await load()).state);
    assert.equal(reloaded.products[0].stock, 8);
    assert.equal(reloaded.sales[0].total, 1800);
    assert.equal(reloaded.sales[0].discount, 200);
    assert.equal(snap.state.payments[0][4], "Aprobado");
    assert.equal(reloaded.deliveries[0].paid, true);
    ui.deliveries[0].status = "Entregado";
    ui.products[0].published = true;
    ui.store = "Emprendimiento QA";
    ui.theme = "light";
    ui = await commit(ui);
    assert.equal(ui.deliveries[0].status, "Entregado");
    assert.equal(ui.products[0].stock, 8);
    assert.equal(ui.theme, "light");
    const history = structuredClone(snap.state.sales);
    ui.products[0].price = 1200;
    ui = await commit(ui);
    assert.deepEqual(snap.state.sales, history);
    const version = snap.version;
    ui.products[0].stock = -1;
    await assert.rejects(commit(ui), /cantidades/);
    assert.equal((await load()).version, version);
    ui = liteState(snap.state);
    ui.sales.unshift({
      id: "#9999",
      at: new Date().toISOString(),
      total: 1,
      items: [{ id: 1, qty: 1, price: 1200 }],
    });
    await assert.rejects(commit(ui), /total/);
  } finally {
    await db.close();
  }
});
