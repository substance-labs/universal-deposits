const { UniversalDeposits } = require('@universal-deposits/sdk')
const { curry, memoizeWith, map } = require('ramda')
const fs = require('fs')

// const main = async () => {
//   const destinationAddress = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
//   const destinationToken = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
//   const destinationChain = 100000002

//   const ud = new UniversalDeposits({
//     destinationAddress,
//     destinationToken,
//     destinationChain,
//   })

//   const a = ud.getSafeModuleLogicAddress()
//   console.log('a', a)

//   const b = ud.getSafeModuleProxyAddress()
//   console.log('b', b)

//   const c = ud.getUDSafeAddress()

//   console.log('c', c)
// }

const config = {
  networks: [{ url: process.env['ETH_RPC_URL'] }],
  addressesPath: './addresses.json',
}

const removeAddresesWithZeroBalance =>

const checkUDBalance = curry((_config, _network) => {
  fs.readFile(_config.addressesPath)
    .then(map(removeAddresesWithZeroBalance))
    .then(map(maybeDeployUDSafe))
})

const startBalanceCheckers = (_config) => Promise.all(_config.networks.map(checkUDBalance(_config)))

const main = () => readConfig().then(setupEventListeners).then(startBalanceCheckers)
