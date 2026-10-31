import { supabaseAdmin, isAdminConfigured } from "./supabase-admin";

// SERVER-ONLY. Verifies a request's Supabase session token and confirms the
// caller is on the admin allowlist (the `admins` table ∪ the ADMIN_EMAILS env).
// The token is validated against Supabase's auth server, so it can't be forged.

export type AdminCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: number; error: string };

function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function requireAdmin(request: Request): Promise<AdminCheck> {
  if (!isAdminConfigured || !supabaseAdmin) {
    return {
      ok: false,
      status: 503,
      error: "Admin backend not configured (missing SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Not signed in." };

  // Validates signature + expiry against Supabase; returns null user if invalid.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !data.user || !email) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  let allowed = envAdminEmails().includes(email);
  if (!allowed) {
    const { data: row } = await supabaseAdmin
      .from("admins")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    allowed = !!row;
  }

  if (!allowed) return { ok: false, status: 403, error: "Not authorized." };

  return { ok: true, userId: data.user.id, email };
}
