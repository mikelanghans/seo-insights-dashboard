import { createFileRoute } from "@tanstack/react-router";
import { runSeoAuditForUrl } from "@/lib/seo-audit.functions";
import { verifyUser, safeError, assertPublicHttpUrl } from "@/lib/api-guards";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

          // Persist the single-page scan to history.
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from("scans")
            .insert({
              user_id: userId,
              root_url: withProto,
              scope: "single",
              kind: "page",
              audit_type: auditType,
              status: "complete",
              phase: "complete",
              pages_scanned: 1,
              pages_total: 1,
              discovered_url_count: 1,
              report: report as never,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("[seo-audit] failed to save scan:", insertError);
          }

          return Response.json({ ...report, scanId: inserted?.id ?? null });
        } catch (error) {
          return safeError("Audit failed", 500, error);
        }
      },
    },
  },
});
