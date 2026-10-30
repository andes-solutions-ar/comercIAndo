// Keep previously issued Auth callbacks intact while routing to the live remake.
const query = new URLSearchParams(location.search),
  hash = new URLSearchParams(location.hash.slice(1));
if (
  query.has("recovery") ||
  query.has("code") ||
  hash.has("access_token") ||
  hash.has("error_description")
)
  location.replace("/administracion/" + location.search + location.hash);
