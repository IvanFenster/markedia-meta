import { supabaseAdmin, isAdminConfigured } from "./supabase-admin";

/**
 * SERVER-ONLY. Verifies the caller's Supabase session token against Supabase's
 * auth server, so the identity cannot be forged by editing a request body.
 */
export type Caller =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: number; error: string };

export async function requireUser(request: Request): Promise<Caller> {
  if (!isAdminConfigured || !supabaseAdmin) {
    return { ok: false, status: 503, error: "Server is not configured to process this request." };
  }
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "You need to be signed in." };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Your session has expired — sign in again." };
  }
  return { ok: true, userId: data.user.id, email: data.user.email ?? null };
}
