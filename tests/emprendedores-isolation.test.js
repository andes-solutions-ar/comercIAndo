import test from "node:test";
import assert from "node:assert/strict";
import { assertIndependentSupabase } from "../scripts/emprendedores-isolation.mjs";

test("Emprendedores rejects missing config, primary projects and mismatched URLs", () => {
  assert.throws(() => assertIndependentSupabase({}));
  for (const project of ["stwwnqkeiluxllfcjcje", "ilvdzyhpnhgkkcyptxtf"]) {
    assert.throws(() =>
      assertIndependentSupabase({
        VITE_SUPABASE_PROJECT_REF: project,
        VITE_SUPABASE_URL: `https://${project}.supabase.co`,
        VITE_SUPABASE_PUBLISHABLE_KEY: "test-only",
      }),
    );
  }
  assert.throws(() =>
    assertIndependentSupabase({
      VITE_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      VITE_SUPABASE_URL: "https://stwwnqkeiluxllfcjcje.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-only",
    }),
  );
});

test("Emprendedores accepts a separate project with matching environment configuration", () => {
  assert.doesNotThrow(() =>
    assertIndependentSupabase({
      VITE_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-only",
    }),
  );
});
