// Keep previously issued Supabase invitation/recovery links working at the root.
const query = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
if (
  query.has('recovery') ||
  query.has('code') ||
  hash.has('access_token') ||
  hash.has('error_description')
) {
  location.replace('/panel/' + location.search + location.hash);
}
