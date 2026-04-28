import { createFileRoute } from "@tanstack/react-router";
import { runSeoUrlScan } from "@/lib/seo-site-audit.functions";

export const Route = createFileRoute("/api/seo-scan-urls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            urls?: unknown;
          } | null;
          if (!body || !Array.isArray(body.urls)) {
            return Response.json({ error: "Provide a list of URLs to scan." }, { status: 400 });
          }
          const urls = body.urls
            .filter((u): u is string => typeof u === "string" && u.length > 0)
            .slice(0, 50);
          if (urls.length === 0) {
            return Response.json({ error: "No valid URLs provided." }, { status: 400 });
          }
          const pages = await runSeoUrlScan(urls);
          return Response.json({ pages });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Scan failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
