require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => res.json({ status: 'ok' }))
app.use('/', require('./routes/auth'))
app.use('/expenses', require('./routes/expenses'))

module.exports = app

if (require.main === module) {
  app.listen(port, () => console.log(`Server listening on ${port}`))
}

