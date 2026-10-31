const primaryProjects = new Set([
  "stwwnqkeiluxllfcjcje",
  "ilvdzyhpnhgkkcyptxtf",
]);

export function assertIndependentSupabase(env) {
  const project = env.VITE_SUPABASE_PROJECT_REF?.trim();
  if (
    !project ||
    !/^[a-z]{20}$/.test(project) ||
    primaryProjects.has(project) ||
    env.VITE_SUPABASE_URL?.trim() !== `https://${project}.supabase.co` ||
    !env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    throw new Error(
      "Emprendedores requiere su propio proyecto Supabase. Configurá VITE_SUPABASE_PROJECT_REF, VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para esta rama; no uses el proyecto de ComercIAndo principal.",
    );
  }
}
