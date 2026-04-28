import { createFileRoute } from "@tanstack/react-router";
import { runSeoAuditForUrl } from "@/lib/seo-audit.functions";

export const Route = createFileRoute("/api/seo-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            url?: unknown;
            auditType?: unknown;
          } | null;
          if (!body || typeof body.url !== "string") {
            return Response.json({ error: "Please enter a valid URL." }, { status: 400 });
          }
          const auditType = body.auditType === "a11y" ? "a11y" : "seo";
          const report = await runSeoAuditForUrl(body.url, auditType);
          return Response.json(report);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Audit failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
