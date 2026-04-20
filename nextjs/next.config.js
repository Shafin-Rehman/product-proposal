/** @type {import('next').NextConfig} */

const REQUIRED_ENV = [
  { key: 'DATABASE_URL',              format: /^postgres(ql)?:\/\//,  hint: 'must be a postgresql:// connection string' },
  { key: 'SUPABASE_URL',              format: /^https:\/\//,           hint: 'must be an https:// URL' },
  { key: 'SUPABASE_ANON_KEY',         format: /^eyJ/,                  hint: 'must be a JWT (starts with eyJ)' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', format: /^eyJ/,                  hint: 'must be a JWT (starts with eyJ)' },
]

if (process.env.NODE_ENV !== 'test') {
  const missing = []
  const malformed = []

  for (const { key, format, hint } of REQUIRED_ENV) {
    const val = process.env[key]
    if (!val) {
      missing.push(key)
    } else if (!format.test(val)) {
      malformed.push(`${key} (${hint})`)
    }
  }

  if (missing.length > 0) {
    throw new Error(`[env] Missing required environment variables: ${missing.join(', ')}`)
  }
  if (malformed.length > 0) {
    throw new Error(`[env] Malformed environment variables:\n  - ${malformed.join('\n  - ')}`)
  }
}

const nextConfig = {}
module.exports = nextConfig
