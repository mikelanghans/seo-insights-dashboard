import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeBatch } from "@/lib/batch-runner.server";

/**
 * Scheduled tick from pg_cron. Finds active, due batches and kicks them off.
 * Authenticated via the Supabase publishable key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/batch-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("batches")
          .select("id")
          .eq("is_active", true)
          .neq("schedule_type", "manual")
          .not("next_run_at", "is", null)
          .lte("next_run_at", nowIso)
          .limit(20);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        const ids = (due ?? []).map((r) => r.id as string);
        const results: { batchId: string; ok: boolean; error?: string }[] = [];
        for (const batchId of ids) {
          const res = await executeBatch(batchId, "scheduled");
          if ("error" in res) results.push({ batchId, ok: false, error: res.error });
          else results.push({ batchId, ok: true });
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
