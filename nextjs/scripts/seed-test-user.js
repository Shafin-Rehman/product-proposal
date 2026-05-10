
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_EMAIL = 'tester@gmail.com'
const TEST_PASSWORD = 'tester123'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Failed to list users:', listError.message)
    process.exit(1)
  }

  const exists = users.some(u => u.email === TEST_EMAIL)
  if (exists) {
    console.log('Test user already exists, skipping.')
    return
  }

  const { error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true
  })

  if (error) {
    console.error('Failed to create test user:', error.message)
    process.exit(1)
  }

  console.log('Test user created.')
}

run()
