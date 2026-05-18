import { supabase } from "@/integrations/supabase/client";

export interface ClientWebsite {
  id: string;
  clientId: string;
  url: string;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  client_id: string;
  url: string;
  label: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

function map(row: Row): ClientWebsite {
  return {
    id: row.id,
    clientId: row.client_id,
    url: row.url,
    label: row.label,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function listClientWebsites(clientId: string): Promise<ClientWebsite[]> {
  const { data, error } = await supabase
    .from("client_websites")
    .select("id, client_id, url, label, is_primary, created_at, updated_at")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(map);
}

export async function createClientWebsite(input: {
  clientId: string;
  url: string;
  label?: string | null;
  isPrimary?: boolean;
}): Promise<ClientWebsite | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { error: "You must be signed in." };
  const normalized = normalizeUrl(input.url);
  if (!normalized) return { error: "Please enter a valid URL." };

  // If marking primary, clear other primaries for this client first.
  if (input.isPrimary) {
    await supabase
      .from("client_websites")
      .update({ is_primary: false })
      .eq("client_id", input.clientId);
  } else {
    // If this is the first website, make it primary by default.
    const { count } = await supabase
      .from("client_websites")
      .select("id", { count: "exact", head: true })
      .eq("client_id", input.clientId);
    if ((count ?? 0) === 0) input.isPrimary = true;
  }

  const { data, error } = await supabase
    .from("client_websites")
    .insert({
      client_id: input.clientId,
      user_id: userId,
      url: normalized,
      label: input.label?.trim() ? input.label.trim() : null,
      is_primary: !!input.isPrimary,
    })
    .select("id, client_id, url, label, is_primary, created_at, updated_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add website." };
  return map(data as Row);
}

export async function updateClientWebsite(
  id: string,
  patch: { url?: string; label?: string | null; isPrimary?: boolean; clientId?: string },
): Promise<boolean> {
  const updates: Partial<Row> = {};
  if (typeof patch.url === "string") {
    const n = normalizeUrl(patch.url);
    if (!n) return false;
    updates.url = n;
  }
  if (patch.label !== undefined) updates.label = patch.label?.trim() ? patch.label.trim() : null;
  if (patch.isPrimary !== undefined) updates.is_primary = patch.isPrimary;

  if (patch.isPrimary && patch.clientId) {
    await supabase
      .from("client_websites")
      .update({ is_primary: false })
      .eq("client_id", patch.clientId);
  }

  const { error } = await supabase.from("client_websites").update(updates).eq("id", id);
  return !error;
}

export async function deleteClientWebsite(id: string): Promise<boolean> {
  const { error } = await supabase.from("client_websites").delete().eq("id", id);
  return !error;
}
