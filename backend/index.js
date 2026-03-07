require('dotenv').config()
const express = require('express')
const db = require('./db')
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server listening on ${port}`)
})
