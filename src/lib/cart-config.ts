export type CartSource = 'supabase';

export function getClientCartSource(): CartSource {
  return 'supabase';
}

export function isSupabaseCart(): boolean {
  return true;
}
