import { createFileRoute } from "@tanstack/react-router";
import { runSeoAuditForUrl } from "@/lib/seo-audit.functions";
import { verifyUser, safeError, assertPublicHttpUrl } from "@/lib/api-guards";

export const Route = createFileRoute("/api/seo-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) return safeError("Unauthorized", 401);

        try {
          const body = (await request.json().catch(() => null)) as {
            url?: unknown;
            auditType?: unknown;
          } | null;
          if (!body || typeof body.url !== "string" || body.url.length === 0) {
            return safeError("Please enter a valid URL.", 400);
          }
          if (body.url.length > 2048) return safeError("URL is too long.", 400);

          const withProto = /^https?:\/\//i.test(body.url.trim())
            ? body.url.trim()
            : `https://${body.url.trim()}`;
          try {
            assertPublicHttpUrl(withProto);
          } catch (e) {
            return safeError(e instanceof Error ? e.message : "Invalid URL", 400);
          }

          const auditType = body.auditType === "a11y" ? "a11y" : "seo";
          const report = await runSeoAuditForUrl(withProto, auditType);
          return Response.json(report);
        } catch (error) {
          return safeError("Audit failed", 500, error);
        }
      },
    },
  },
});
