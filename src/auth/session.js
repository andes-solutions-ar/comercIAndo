import { supabase } from "../lib/supabase.js";
import { canEnter } from "./guard.js";
export async function loadIdentity(session) {
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!canEnter(session, data))
    throw new Error(
      "Tu usuario no tiene un acceso administrativo activo. Contactá a Andes Solutions.",
    );
  return data;
}
export function watchSession(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(() => callback(event, session), 0);
  });
}
