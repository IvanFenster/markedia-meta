import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Never import this into a client component — it uses the
// service-role key, which bypasses RLS. It is only referenced by /api/admin/*.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = !!(url && serviceKey);

export const supabaseAdmin = isAdminConfigured
  ? createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
