import { supabase } from "@/integrations/supabase/client";

export type ScanKind = "site" | "page";
export type AuditType = "seo" | "a11y";
export type Scope = "quick" | "standard" | "deep";
export type ScheduleType = "manual" | "daily" | "weekly" | "monthly";

export interface Batch {
  id: string;
  name: string;
  scanKind: ScanKind;
  auditType: AuditType;
  scope: Scope;
  scheduleType: ScheduleType;
  scheduleHour: number;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  targetCount?: number;
}

export interface BatchTarget {
  id: string;
  batchId: string;
  clientId: string;
  clientWebsiteId: string;
}

export interface BatchRun {
  id: string;
  batchId: string;
  trigger: "manual" | "scheduled";
  status: "running" | "complete" | "failed";
  scansTotal: number;
  scansCompleted: number;
  scansFailed: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

type BatchRow = {
  id: string;
  name: string;
  scan_kind: ScanKind;
  audit_type: AuditType;
  scope: Scope;
  schedule_type: ScheduleType;
  schedule_hour: number;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
};

function mapBatch(row: BatchRow, targetCount?: number): Batch {
  return {
    id: row.id,
    name: row.name,
    scanKind: row.scan_kind,
    auditType: row.audit_type,
    scope: row.scope,
    scheduleType: row.schedule_type,
    scheduleHour: row.schedule_hour,
    scheduleDayOfWeek: row.schedule_day_of_week,
    scheduleDayOfMonth: row.schedule_day_of_month,
    isActive: row.is_active,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    targetCount,
  };
}

const BATCH_COLS =
  "id, name, scan_kind, audit_type, scope, schedule_type, schedule_hour, schedule_day_of_week, schedule_day_of_month, is_active, next_run_at, last_run_at, created_at";

export async function listBatches(): Promise<Batch[]> {
  const { data, error } = await supabase
    .from("batches")
    .select(`${BATCH_COLS}, batch_targets(count)`)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as (BatchRow & { batch_targets: { count: number }[] })[]).map((r) =>
    mapBatch(r, r.batch_targets?.[0]?.count ?? 0),
  );
}

export async function getBatch(id: string): Promise<Batch | null> {
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapBatch(data as BatchRow);
}

export async function listBatchTargets(batchId: string): Promise<BatchTarget[]> {
  const { data, error } = await supabase
    .from("batch_targets")
    .select("id, batch_id, client_id, client_website_id")
    .eq("batch_id", batchId);
  if (error || !data) return [];
  return (data as { id: string; batch_id: string; client_id: string; client_website_id: string }[]).map(
    (r) => ({
      id: r.id,
      batchId: r.batch_id,
      clientId: r.client_id,
      clientWebsiteId: r.client_website_id,
    }),
  );
}

export async function createBatch(input: {
  name: string;
  scanKind: ScanKind;
  auditType: AuditType;
  scope: Scope;
  scheduleType: ScheduleType;
  scheduleHour: number;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  targets: { clientId: string; clientWebsiteId: string }[];
}): Promise<{ id: string } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { error: "You must be signed in." };
  if (!input.name.trim()) return { error: "Name is required." };
  if (input.targets.length === 0) return { error: "Select at least one website." };

  const nextRunAt = computeNextRunAtClient(input);

  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      scan_kind: input.scanKind,
      audit_type: input.auditType,
      scope: input.scope,
      schedule_type: input.scheduleType,
      schedule_hour: input.scheduleHour,
      schedule_day_of_week: input.scheduleDayOfWeek,
      schedule_day_of_month: input.scheduleDayOfMonth,
      next_run_at: nextRunAt?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error || !batch) return { error: error?.message ?? "Could not create batch." };

  const rows = input.targets.map((t) => ({
    batch_id: batch.id,
    user_id: userId,
    client_id: t.clientId,
    client_website_id: t.clientWebsiteId,
  }));
  const { error: tErr } = await supabase.from("batch_targets").insert(rows);
  if (tErr) return { error: tErr.message };
  return { id: batch.id };
}

export async function setBatchActive(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase.from("batches").update({ is_active: isActive }).eq("id", id);
  return !error;
}

export async function deleteBatch(id: string): Promise<boolean> {
  const { error } = await supabase.from("batches").delete().eq("id", id);
  return !error;
}

export async function runBatchNow(batchId: string): Promise<{ batchRunId: string } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { error: "Sign in to run a batch." };
  const res = await fetch("/api/batches/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ batchId }),
  });
  const data = (await res.json().catch(() => null)) as
    | { batchRunId?: string; error?: string }
    | null;
  if (!res.ok || !data?.batchRunId) {
    return { error: data?.error ?? "Could not start batch." };
  }
  return { batchRunId: data.batchRunId };
}

export async function listBatchRuns(batchId: string, limit = 20): Promise<BatchRun[]> {
  const { data, error } = await supabase
    .from("batch_runs")
    .select(
      "id, batch_id, trigger, status, scans_total, scans_completed, scans_failed, started_at, completed_at, error_message",
    )
    .eq("batch_id", batchId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (
    data as {
      id: string;
      batch_id: string;
      trigger: "manual" | "scheduled";
      status: "running" | "complete" | "failed";
      scans_total: number;
      scans_completed: number;
      scans_failed: number;
      started_at: string;
      completed_at: string | null;
      error_message: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    batchId: r.batch_id,
    trigger: r.trigger,
    status: r.status,
    scansTotal: r.scans_total,
    scansCompleted: r.scans_completed,
    scansFailed: r.scans_failed,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    errorMessage: r.error_message,
  }));
}

function computeNextRunAtClient(input: {
  scheduleType: ScheduleType;
  scheduleHour: number;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
}): Date | null {
  if (input.scheduleType === "manual") return null;
  const base = new Date();
  const next = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), input.scheduleHour, 0, 0, 0),
  );
  if (input.scheduleType === "daily") {
    if (next <= base) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (input.scheduleType === "weekly") {
    const target = input.scheduleDayOfWeek ?? 1;
    while (next.getUTCDay() !== target || next <= base) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  if (input.scheduleType === "monthly") {
    const target = Math.min(Math.max(input.scheduleDayOfMonth ?? 1, 1), 28);
    next.setUTCDate(target);
    if (next <= base) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(target);
    }
    return next;
  }
  return null;
}

export function describeSchedule(b: Batch): string {
  const hh = b.scheduleHour.toString().padStart(2, "0") + ":00 UTC";
  if (b.scheduleType === "manual") return "Manual";
  if (b.scheduleType === "daily") return `Daily at ${hh}`;
  if (b.scheduleType === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `Weekly · ${days[b.scheduleDayOfWeek ?? 1]} ${hh}`;
  }
  if (b.scheduleType === "monthly") {
    return `Monthly · day ${b.scheduleDayOfMonth ?? 1} ${hh}`;
  }
  return "—";
}
