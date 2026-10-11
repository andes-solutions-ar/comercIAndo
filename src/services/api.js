import { supabase } from "../lib/supabase.js";
export async function query(table, configure = (q) => q) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await configure(
      supabase.from(table).select("*").order("id"),
    ).range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
    from += 500;
  }
}
export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
export async function updateSettings(fields) {
  const { error } = await supabase
    .from("app_settings")
    .update(fields)
    .eq("id", true)
    .select("id")
    .single();
  if (error) throw error;
}
export async function edge(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return data;
}
