import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the service role key. Use only on the server
 * (Server Components, Route Handlers, Server Actions).
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
