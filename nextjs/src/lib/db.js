import dns from 'dns'
import { Pool } from 'pg'

dns.setDefaultResultOrder('ipv4first')

const connectionString = process.env.DATABASE_URL ?? ''
const isLocalDatabase =
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('localhost')

const pool = new Pool({
  connectionString,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
})

export default pool