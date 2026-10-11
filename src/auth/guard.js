export const canEnter = (session, profile) =>
  Boolean(
    session?.user &&
    profile?.id === session.user.id &&
    profile.active &&
    ["admin", "super_admin"].includes(profile.access_level),
  );
export const allowed = (profile, permission) =>
  Boolean(
    profile?.active &&
    (profile.access_level === "super_admin" ||
      profile.permissions?.[permission] === true),
  );
