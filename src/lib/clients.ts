import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = "id, name, contact_name, notes, created_at, updated_at";

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(SELECT_COLS)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as ClientRow[]).map(mapClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapClient(data as ClientRow);
}

export async function createClient(input: {
  name: string;
  contactName?: string | null;
  notes?: string | null;
}): Promise<Client | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { error: "You must be signed in to create a client." };
  const trimmed = input.name.trim();
  if (!trimmed) return { error: "Client name is required." };
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: trimmed,
      contact_name: input.contactName?.trim() ? input.contactName.trim() : null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create client." };
  return mapClient(data as ClientRow);
}

export async function updateClient(
  id: string,
  patch: { name?: string; contactName?: string | null; notes?: string | null },
): Promise<boolean> {
  const updates: { name?: string; contact_name?: string | null; notes?: string | null } = {};
  if (typeof patch.name === "string") updates.name = patch.name.trim();
  if (patch.contactName !== undefined)
    updates.contact_name = patch.contactName?.trim() ? patch.contactName.trim() : null;
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() ? patch.notes.trim() : null;
  if (Object.keys(updates).length === 0) return true;
  const { error } = await supabase.from("clients").update(updates).eq("id", id);
  return !error;
}

export async function deleteClient(id: string): Promise<boolean> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  return !error;
}
