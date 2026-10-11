import { createClient } from "@supabase/supabase-js";
// Capture the flow before Auth consumes and removes the URL fragment.
export const passwordSetupLink =
  typeof window !== "undefined" &&
  /type=(invite|recovery)/.test(window.location.hash);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

if (!hasSupabaseConfig) {
  console.warn("Faltan variables de entorno de Supabase");
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
