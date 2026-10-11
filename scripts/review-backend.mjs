// Local read-only review surface for applying the exact versioned files through the dashboard.
import http from "node:http";
import { readFileSync, readdirSync } from "node:fs";
const base = new URL("../", import.meta.url);
const paths = [
  ...readdirSync(new URL("supabase/migrations/", base))
    .sort()
    .map((n) => "supabase/migrations/" + n),
  "supabase/functions/admin-invite-user/index.ts",
  "supabase/functions/create-web-order/index.ts",
];
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
http
  .createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").searchParams.get("file");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      "<h1>Revisión backend ComercIAndo</h1>" +
        paths
          .map(
            (p) =>
              '<p><a href="/?file=' +
              encodeURIComponent(p) +
              '">' +
              p +
              "</a></p>",
          )
          .join("") +
        (paths.includes(path)
          ? "<h2>" +
            path +
            '</h2><textarea id="source" rows="30" cols="120">' +
            escape(readFileSync(new URL(path, base), "utf8")) +
            "</textarea>"
          : ""),
    );
  })
  .listen(5176, "127.0.0.1", () =>
    console.log("Read-only backend review: http://127.0.0.1:5176"),
  );
