import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, notes, created_at, updated_at")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as ClientRow[]).map(mapClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, notes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapClient(data as ClientRow);
}

export async function createClient(input: {
  name: string;
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
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("id, name, notes, created_at, updated_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create client." };
  return mapClient(data as ClientRow);
}

export async function updateClient(
  id: string,
  patch: { name?: string; notes?: string | null },
): Promise<boolean> {
  const updates: { name?: string; notes?: string | null } = {};
  if (typeof patch.name === "string") updates.name = patch.name.trim();
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() ? patch.notes.trim() : null;
  if (Object.keys(updates).length === 0) return true;
  const { error } = await supabase.from("clients").update(updates).eq("id", id);
  return !error;
}

export async function deleteClient(id: string): Promise<boolean> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  return !error;
}
