import { createFileRoute } from "@tanstack/react-router";
import { runSeoUrlScan } from "@/lib/seo-site-audit.functions";
import { verifyUser, safeError, assertPublicHttpUrl } from "@/lib/api-guards";

export const Route = createFileRoute("/api/seo-scan-urls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) return safeError("Unauthorized", 401);

        try {
          const body = (await request.json().catch(() => null)) as {
            urls?: unknown;
          } | null;
          if (!body || !Array.isArray(body.urls)) {
            return safeError("Provide a list of URLs to scan.", 400);
          }
          const urls: string[] = [];
          for (const u of body.urls) {
            if (typeof u !== "string" || u.length === 0 || u.length > 2048) continue;
            try {
              assertPublicHttpUrl(u);
              urls.push(u);
            } catch {
              // skip disallowed URLs
            }
            if (urls.length >= 50) break;
          }
          if (urls.length === 0) return safeError("No valid URLs provided.", 400);

          const pages = await runSeoUrlScan(urls);
          return Response.json({ pages });
        } catch (error) {
          return safeError("Scan failed", 500, error);
        }
      },
    },
  },
});
