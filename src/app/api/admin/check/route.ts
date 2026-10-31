import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Lightweight: returns { admin: boolean } so the UI can decide whether to show
// the Admin Panel link. Never leaks data — non-admins simply get admin:false.
export async function GET(request: Request) {
  const res = await requireAdmin(request);
  return Response.json({ admin: res.ok });
}
