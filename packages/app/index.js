const express = require('express')
const fs = require('fs')

const app = express()
const FILE_PATH = '../evm/scripts/addresses.txt'

app.get('/newaddress', (req, res) => {
  if (!req.query.address) return res.status(400).send('Missing address')
  const address = req.query.address
  fs.appendFileSync(FILE_PATH, address + '\n')
  console.log('Address saved', address)
  res.status(200).send()
})

app.listen(3000, () => console.log('Server running on port 3000'))
