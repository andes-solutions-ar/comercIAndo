import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
export async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`,
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
  return db;
}
test("migrations install with RLS, no anonymous private data, and audited initial stock", async () => {
  const db = await setup();
  try {
    await db.exec(
      `insert into auth.users values('00000000-0000-0000-0000-000000000001','owner@example.test');insert into public.profiles(id,full_name,access_level) values('00000000-0000-0000-0000-000000000001','Owner','super_admin');set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';set role authenticated;`,
    );
    const result = await db.query(`select public.save_product($1::jsonb) id`, [
      JSON.stringify({
        name: "Producto",
        category: "General",
        price: 1210,
        stock_quantity: 10,
        minimum_stock: 2,
        visual_hue: 210,
        published: true,
      }),
    ]);
    assert.ok(result.rows[0].id);
    assert.equal(
      (await db.query("select quantity from public.stock_movements")).rows[0]
        .quantity,
      10,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from public.products"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.finish_invitation(null,null)"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.create_web_order(null)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("real SQL transactions enforce sale totals, stock, rollback, reservations and delivery exactly once", async () => {
  const db = await setup();
  const owner = "00000000-0000-0000-0000-000000000001";
  const call = async (name, args) => {
    const names = Object.keys(args);
    const result = await db.query(
      `select public.${name}(${names.map((n, i) => n + "=> $" + (i + 1)).join(",")}) value`,
      Object.values(args).map((v) =>
        typeof v === "object" ? JSON.stringify(v) : v,
      ),
    );
    return result.rows[0].value;
  };
  try {
    await db.exec(
      `insert into auth.users values('${owner}','owner@example.test');insert into public.profiles(id,full_name,access_level) values('${owner}','Owner','super_admin');set request.jwt.claim.sub='${owner}';set role authenticated;`,
    );
    const product = await call("save_product", {
      payload: {
        name: "Producto A",
        category: "General",
        price: 1210,
        stock_quantity: 10,
        minimum_stock: 2,
        visual_hue: 210,
        published: true,
      },
    });
    const request = {
      request_id: randomUUID(),
      customer_name: "Mostrador",
      payment_method: "Efectivo",
      cash_received: 3000,
      items: [{ product_id: product, quantity: 2, unit_price: 1 }],
    };
    const sale = await call("create_pos_sale", { payload: request });
    assert.equal(await call("create_pos_sale", { payload: request }), sale);
    const row = (
      await db.query("select * from public.sales where id=$1", [sale])
    ).rows[0];
    assert.equal(Number(row.total), 2420);
    assert.equal(Number(row.subtotal), 2000);
    assert.equal(Number(row.tax_amount), 420);
    assert.equal(
      Number(
        (
          await db.query(
            "select change_amount from public.payments where sale_id=$1",
            [sale],
          )
        ).rows[0].change_amount,
      ),
      580,
    );
    assert.equal(
      (await db.query("select stock_quantity from public.products")).rows[0]
        .stock_quantity,
      8,
    );
    const countBefore = (await db.query("select count(*) n from public.sales"))
      .rows[0].n;
    await assert.rejects(
      call("create_pos_sale", {
        payload: {
          ...request,
          request_id: randomUUID(),
          items: [{ product_id: product, quantity: 9 }],
        },
      }),
      /Stock disponible insuficiente/,
    );
    assert.equal(
      (await db.query("select count(*) n from public.sales")).rows[0].n,
      countBefore,
    );
    await assert.rejects(
      call("create_pos_sale", {
        payload: { ...request, request_id: randomUUID(), items: undefined },
      }),
      /Carrito vacío/,
    );
    await assert.rejects(
      call("create_pos_sale", {
        payload: {
          ...request,
          request_id: randomUUID(),
          items: [
            { product_id: product, quantity: 3 },
            { product_id: product, quantity: -1 },
          ],
        },
      }),
      /Cantidad inválida/,
    );
    const moveId = randomUUID();
    await call("move_stock", {
      payload: {
        request_id: moveId,
        product_id: product,
        type: "Entrada",
        quantity: 2,
        reference: "Ingreso",
      },
    });
    await call("move_stock", {
      payload: {
        request_id: moveId,
        product_id: product,
        type: "Entrada",
        quantity: 2,
        reference: "Ingreso",
      },
    });
    assert.equal(
      (await db.query("select stock_quantity from public.products")).rows[0]
        .stock_quantity,
      10,
    );
    await db.exec(
      "update public.app_settings set public_catalog_enabled=true,web_orders_enabled=true;reset role;set role service_role;",
    );
    const order = await call("create_web_order", {
      payload: {
        request_id: randomUUID(),
        customer_name: "Web",
        items: [{ product_id: product, quantity: 4 }],
      },
    });
    await db.exec("reset role;set role authenticated;");
    assert.equal(
      (await db.query("select * from public.inventory()")).rows[0].available,
      6,
    );
    assert.equal(
      (await db.query("select stock_quantity from public.products")).rows[0]
        .stock_quantity,
      10,
    );
    await assert.rejects(
      call("move_stock", {
        payload: {
          request_id: randomUUID(),
          product_id: product,
          type: "Salida",
          quantity: 7,
          reference: "Ajuste",
        },
      }),
      /Stock disponible insuficiente/,
    );
    const delivery = (
      await db.query("select id from public.deliveries where sale_id=$1", [
        order,
      ])
    ).rows[0].id;
    assert.equal(await call("advance_delivery", { delivery }), "Preparado");
    await assert.rejects(
      call("advance_delivery", { delivery }),
      /Confirmá el cobro/,
    );
    const payment = (
      await db.query("select id from public.payments where sale_id=$1", [order])
    ).rows[0].id;
    await call("confirm_payment", { payment });
    assert.equal(await call("advance_delivery", { delivery }), "Entregado");
    await assert.rejects(
      call("advance_delivery", { delivery }),
      /ya está completada/,
    );
    assert.equal(
      (await db.query("select stock_quantity from public.products")).rows[0]
        .stock_quantity,
      6,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) n from public.stock_movements where source_type='delivery'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      call("create_web_order", { payload: {} }),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select private.create_sale(null,null)"),
      /permission denied/,
    );
    const quote = await call("save_quote", {
      payload: {
        request_id: randomUUID(),
        customer_name: "Empresa",
        items: [
          { product_id: product, quantity: 2 },
          { product_name: "Servicio libre", quantity: 1, unit_price: 500 },
        ],
      },
    });
    assert.equal(
      Number(
        (await db.query("select total from public.quotes where id=$1", [quote]))
          .rows[0].total,
      ),
      2920,
    );
    for (let i = 0; i < 3; i++)
      await call("reserve_invitation", {
        payload: {
          email: `admin${i}@example.test`,
          full_name: "Admin " + i,
          permissions: { pos: true },
        },
      });
    await assert.rejects(
      call("reserve_invitation", {
        payload: { email: "fourth@example.test", full_name: "Fourth" },
      }),
      /Máximo 3/,
    );
    await db.exec("reset role;");
    await db.query("update public.profiles set active=false where id=$1", [
      owner,
    ]);
    await db.exec("set role authenticated;");
    await assert.rejects(
      call("save_product", { payload: {} }),
      /Acceso denegado/,
    );
    assert.equal((await db.query("select * from public.sales")).rows.length, 0);
  } finally {
    await db.close();
  }
});
