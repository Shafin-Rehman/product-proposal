const { Router } = require('express')
const db = require('../db')
const authenticate = require('../middleware/auth')

const router = Router()
router.use(authenticate)

router.post('/', async (req, res) => {
  const { source_id, amount, month, notes } = req.body
  if (!amount || !month) return res.status(400).json({ error: 'amount and month are required' })
  try {
    const { rows } = await db.query(
      `INSERT INTO public.income (user_id, source_id, amount, month, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, source_id ?? null, amount, month, notes ?? null]
    )
    const { user_id, ...income } = rows[0]
    res.status(201).json(income)
  } catch {
    res.status(500).json({ error: 'Failed to create income' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.name AS source_name, s.icon AS source_icon
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE i.user_id = $1
       ORDER BY i.month DESC, i.created_at DESC`,
      [req.user.id]
    )
    res.json(rows.map(({ user_id, ...i }) => i))
  } catch {
    res.status(500).json({ error: 'Failed to fetch income' })
  }
})

router.get('/categories', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT id, name, icon FROM public.income_sources ORDER BY name ASC`)
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Failed to fetch income categories' })
  }
})

router.post('/get', async (req, res) => {
  const { income_id } = req.body
  if (!income_id) return res.status(400).json({ error: 'income_id required' })
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.name AS source_name, s.icon AS source_icon
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [income_id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Income not found' })
    const { user_id, ...income } = rows[0]
    res.json(income)
  } catch {
    res.status(500).json({ error: 'Failed to fetch income' })
  }
})

router.post('/update', async (req, res) => {
  const { income_id, source_id, amount, month, notes } = req.body
  if (!income_id) return res.status(400).json({ error: 'income_id required' })

  const entries = Object.entries({ source_id, amount, month, notes }).filter(([, v]) => v !== undefined)
  if (!entries.length) return res.status(400).json({ error: 'No fields provided to update' })

  const fields = entries.map(([k], i) => `${k} = $${i + 1}`)
  const values = [...entries.map(([, v]) => v), income_id, req.user.id]
  const n = entries.length

  try {
    const { rows } = await db.query(
      `UPDATE public.income SET ${fields.join(', ')} WHERE id = $${n + 1} AND user_id = $${n + 2} RETURNING *`,
      values
    )
    if (!rows.length) return res.status(404).json({ error: 'Income not found' })
    const { user_id, ...income } = rows[0]
    res.json(income)
  } catch {
    res.status(500).json({ error: 'Failed to update income' })
  }
})

router.post('/delete', async (req, res) => {
  const { income_id } = req.body
  if (!income_id) return res.status(400).json({ error: 'income_id required' })
  try {
    const { rows } = await db.query(
      `DELETE FROM public.income WHERE id = $1 AND user_id = $2 RETURNING id`,
      [income_id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Income not found' })
    res.status(204).send()
  } catch {
    res.status(500).json({ error: 'Failed to delete income' })
  }
})

module.exports = router
