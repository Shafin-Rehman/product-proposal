import { createClient } from '@supabase/supabase-js'

let supabaseClient

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are required.')
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}

export async function signUp(email, password) {
  return await getSupabaseClient().auth.signUp({ email, password })
}

export async function signIn(email, password) {
  return await getSupabaseClient().auth.signInWithPassword({ email, password })
}

export async function getUser(token) {
  const { data: { user }, error } = await getSupabaseClient().auth.getUser(token)
  if (error || !user) return null
  return user
}
