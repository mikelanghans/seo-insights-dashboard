import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Validate a Supabase JWT from the Authorization header. Returns user id or null. */
export async function verifyUser(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

/** Generic safe error response. Logs detail server-side. */
export function safeError(message: string, status: number, detail?: unknown): Response {
  if (detail) console.error(`[api] ${message}:`, detail);
  return Response.json({ error: message }, { status });
}

/**
 * Reject URLs that target private/internal networks (SSRF guard).
 * Only allows http(s) schemes and rejects IP literals + private hostnames.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".")) throw new Error("Invalid URL");

  // Block localhost variants
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") {
    throw new Error("URL not allowed");
  }

  // Block IPv6 literals entirely (incl. ::1, link-local, ULA)
  if (host.startsWith("[") || host.includes(":")) {
    throw new Error("URL not allowed");
  }

  // Block IPv4 literals in private/loopback/link-local/metadata ranges
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) || // link-local + AWS/GCP metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast + reserved
    ) {
      throw new Error("URL not allowed");
    }
  }

  // Block .internal / .local mDNS-style hostnames
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("URL not allowed");
  }

  return parsed;
}
