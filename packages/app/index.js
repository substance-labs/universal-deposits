const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()
const FILE_PATH = '../deploy-service/addresses.txt'

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*') // Allow all domains
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, ngrok-skip-browser-warning',
  )

  // Handle preflight requests (for complex requests like PUT/DELETE)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')))

app.get('/newaddress', (req, res) => {
  if (!req.query.address) return res.status(400).send('Missing address')
  const address = req.query.address
  fs.appendFileSync(FILE_PATH, address + '\n')
  console.log('Address saved', address)
  res.status(200).send('new address added')
})

app.listen(3000, () => console.log('Server running on port 3000'))
