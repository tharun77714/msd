
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Ensure environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key for server client. Check .env file.');
}

// Server client for use in Server Actions and Route Handlers
export function createSupabaseServerActionClient() {
  const cookieStore = cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Occurs during pre-rendering or static generation, safe to ignore
            console.warn(`Supabase Server Client: Failed to set cookie '${name}' (static phase). Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Occurs during pre-rendering or static generation, safe to ignore
             console.warn(`Supabase Server Client: Failed to remove cookie '${name}' (static phase). Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      },
    }
  );
}

// Server client for use in Server Components (read-only operations)
export function createSupabaseServerComponentClient() {
  const cookieStore = cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // No set/remove for server components as they should not modify cookies directly
      },
    }
  );
}
