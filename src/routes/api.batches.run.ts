import { createFileRoute } from "@tanstack/react-router";
import { verifyUser, safeError } from "@/lib/api-guards";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeBatch } from "@/lib/batch-runner.server";

export const Route = createFileRoute("/api/batches/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) return safeError("Unauthorized", 401);

        const body = (await request.json().catch(() => null)) as { batchId?: unknown } | null;
        if (!body || typeof body.batchId !== "string") {
          return safeError("batchId is required", 400);
        }

        // Verify ownership
        const { data: batch } = await supabaseAdmin
          .from("batches")
          .select("id, user_id")
          .eq("id", body.batchId)
          .maybeSingle();
        if (!batch || batch.user_id !== userId) {
          return safeError("Batch not found", 404);
        }

        const result = await executeBatch(body.batchId, "manual");
        if ("error" in result) return safeError(result.error, 500);
        return Response.json({ batchRunId: result.batchRunId });
      },
    },
  },
});
