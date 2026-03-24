import dns from 'dns'
import { Pool } from 'pg'

dns.setDefaultResultOrder('ipv4first')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

pool.connect()
  .then(client => { console.log('connected to db'); client.release() })
  .catch(err => console.error('db connection failed:', err.message))

export default pool 
