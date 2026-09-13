// Supabase: auth + cloud memory for progress, charts and community tags.
// Offline-first: when keys are absent (local dev, pre-launch) every
// helper below no-ops and the app runs on localStorage exactly as today.
// Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to go live.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export function isCloudEnabled(): boolean {
  return supabase !== null;
}

// Tables (create in the Supabase dashboard SQL editor):
//   profiles   (id uuid pk references auth.users, name text, created_at timestamptz)
//   sessions   (id uuid pk default gen_random_uuid(), user_id uuid, kind text,
//               ref text, accuracy int, grade text, at timestamptz)
//   charts     (user_id uuid, song_id text, notes jsonb, updated_at timestamptz,
//               primary key (user_id, song_id))
// RLS: owners read/write their own rows; charts readable by all logged-in
// users once community sharing ships (for now: owner-only).
export async function cloudSyncSessions(
  userId: string,
  entries: Array<{
    songId: string;
    songTitle: string;
    accuracy: number;
    grade: string;
    at: number;
  }>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const rows = entries.map((e) => ({
      user_id: userId,
      kind: e.songId.split(":")[0],
      ref: e.songId,
      accuracy: e.accuracy,
      grade: e.grade,
      at: new Date(e.at).toISOString(),
    }));
    const { error } = await supabase.from("sessions").upsert(rows, {
      onConflict: "user_id,ref,at",
      ignoreDuplicates: true,
    });
    return !error;
  } catch {
    return false;
  }
}
