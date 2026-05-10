const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const root = path.join(__dirname, '..')
const rq = createRequire(path.join(root, 'nextjs/package.json'))
rq('dotenv').config({ path: path.join(root, 'nextjs/.env') })
const { createClient } = rq('@supabase/supabase-js')

const keyFile = process.argv[2]
const url = process.env.SUPABASE_URL
const email = 'tester@gmail.com'
const password = 'tester123'

if (!keyFile || !url) {
  console.error('expected: key-file path and SUPABASE_URL')
  process.exit(1)
}

let key
try {
  key = fs.readFileSync(keyFile, 'utf8').trim()
} finally {
  try {
    fs.unlinkSync(keyFile)
  } catch (_) {}
}

if (!key) {
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
})

;(async () => {
  const { data, error: e1 } = await supabase.auth.admin.listUsers()
  if (e1) {
    console.error(e1.message)
    process.exit(1)
  }
  const users = data?.users ?? []
  if (users.some(u => u.email === email)) {
    console.log('skip')
    return
  }
  const { error: e2 } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (e2) {
    console.error(e2.message)
    process.exit(1)
  }
  console.log('ok')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
