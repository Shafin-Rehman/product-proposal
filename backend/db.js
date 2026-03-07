const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

pool.connect()
  .then(client => {
    console.log('connected to supabase db')
    client.release()
  })
  .catch(err => console.error('db connection failed:', err.message))

module.exports = pool
