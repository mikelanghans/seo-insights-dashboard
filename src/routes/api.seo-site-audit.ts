import { createFileRoute } from "@tanstack/react-router";
import { runSeoSiteAudit, type SiteScanScope } from "@/lib/seo-site-audit.functions";

const VALID_SCOPES: SiteScanScope[] = ["quick", "standard", "deep"];

export const Route = createFileRoute("/api/seo-site-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            url?: unknown;
            scope?: unknown;
          } | null;
          if (!body || typeof body.url !== "string") {
            return Response.json({ error: "Please enter a valid URL." }, { status: 400 });
          }
          const scope: SiteScanScope =
            typeof body.scope === "string" && VALID_SCOPES.includes(body.scope as SiteScanScope)
              ? (body.scope as SiteScanScope)
              : "standard";

          const report = await runSeoSiteAudit(body.url, scope);
          return Response.json(report);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Site audit failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
