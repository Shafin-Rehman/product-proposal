const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function getUser(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function signUp(email, password) {
  return await supabase.auth.signUp({ email, password })
}

async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password })
}

module.exports = { getUser, signUp, signIn }
