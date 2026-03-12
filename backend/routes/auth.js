const { Router } = require('express')
const db = require('../db')
const supabaseClient = require('../supabaseClient')

const router = Router()

const upsertUser = (id, email) =>
  db.query(
    `INSERT INTO public.users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [id, email]
  )

router.post('/signup', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  try {
    const { data, error } = await supabaseClient.signUp(email, password)
    if (error) return res.status(400).json({ error: error.message })
    await upsertUser(data.user.id, data.user.email)
    res.status(201).json({ user: data.user, access_token: data.session?.access_token })
  } catch {
    res.status(500).json({ error: 'Failed to sign up user' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  try {
    const { data, error } = await supabaseClient.signIn(email, password)
    if (error) return res.status(401).json({ error: error.message })
    await upsertUser(data.user.id, data.user.email)
    res.json({ user: data.user, access_token: data.session.access_token })
  } catch {
    res.status(500).json({ error: 'Failed to log in user' })
  }
})

module.exports = router
