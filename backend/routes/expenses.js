const { Router } = require('express')
const db = require('../db')
const authenticate = require('../middleware/auth')

const router = Router()
router.use(authenticate)

router.post('/', async (req, res) => {
  const { category_id, amount, description, date } = req.body
  if (!amount || !date) return res.status(400).json({ error: 'amount and date are required' })
  try {
    const { rows } = await db.query(
      `INSERT INTO public.expenses (user_id, category_id, amount, description, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, category_id ?? null, amount, description ?? null, date]
    )
    const { user_id, ...expense } = rows[0]
    res.status(201).json(expense)
  } catch {
    res.status(500).json({ error: 'Failed to create expense' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.user_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [req.user.id]
    )
    res.json(rows.map(({ user_id, ...e }) => e))
  } catch {
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

router.post('/get', async (req, res) => {
  const { expense_id } = req.body
  if (!expense_id) return res.status(400).json({ error: 'expense_id required' })
  try {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.id = $1 AND e.user_id = $2`,
      [expense_id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Expense not found' })
    const { user_id, ...expense } = rows[0]
    res.json(expense)
  } catch {
    res.status(500).json({ error: 'Failed to fetch expense' })
  }
})

router.post('/update', async (req, res) => {
  const { expense_id, category_id, amount, description, date } = req.body
  if (!expense_id) return res.status(400).json({ error: 'expense_id required' })

  const entries = Object.entries({ category_id, amount, description, date }).filter(([, v]) => v !== undefined)
  if (!entries.length) return res.status(400).json({ error: 'No fields provided to update' })

  const fields = entries.map(([k], i) => `${k} = $${i + 1}`)
  const values = [...entries.map(([, v]) => v), expense_id, req.user.id]
  const n = entries.length

  try {
    const { rows } = await db.query(
      `UPDATE public.expenses SET ${fields.join(', ')} WHERE id = $${n + 1} AND user_id = $${n + 2} RETURNING *`,
      values
    )
    if (!rows.length) return res.status(404).json({ error: 'Expense not found' })
    const { user_id, ...expense } = rows[0]
    res.json(expense)
  } catch {
    res.status(500).json({ error: 'Failed to update expense' })
  }
})

router.post('/delete', async (req, res) => {
  const { expense_id } = req.body
  if (!expense_id) return res.status(400).json({ error: 'expense_id required' })
  try {
    const { rows } = await db.query(
      `DELETE FROM public.expenses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [expense_id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Expense not found' })
    res.status(204).send()
  } catch {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
})

module.exports = router
