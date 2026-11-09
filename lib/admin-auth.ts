import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_USER_ID = "ee09187d-104a-4872-b6a9-0f754b1b8bf7";

type AdminAuthorization =
  | { authorized: true; admin: ReturnType<typeof createAdminClient>; user: User }
  | { authorized: false; status: 401 | 403; message: string };

export async function authorizeAdmin(request: Request): Promise<AdminAuthorization> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return { authorized: false, status: 401, message: "Authentication required." };
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error
  } = await admin.auth.getUser(token);

  if (error || !user) {
    return { authorized: false, status: 401, message: "Your session is invalid or expired." };
  }

  if (user.id !== ADMIN_USER_ID || user.app_metadata?.is_admin !== true) {
    return { authorized: false, status: 403, message: "Admin access is not enabled for this account." };
  }

  return { authorized: true, admin, user };
}
