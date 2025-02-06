require('dotenv').config()
const { UniversalDeposits } = require('@universal-deposits/sdk')
const { curry, memoizeWith, map } = require('ramda')
const fs = require('fs')

const main = async () => {
  const destinationAddress =
    process.env['DESTINATION_ADDRESS'] || '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
  const destinationToken =
    process.env['DESTINATION_TOKEN'] || '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
  const destinationChain = process.env['DESTINATION_CHAIN'] || '100'
  const destinationUrl = process.env['DESTINATION_URL']
  let urls = process.env['URLS'].trim().split(',')
  const ud = new UniversalDeposits({
    destinationAddress,
    destinationToken,
    destinationChain,
    urls,
  })

  const a = ud.getSafeModuleLogicAddress()
  console.log('a', a)

  const b = ud.getSafeModuleProxyAddress()
  console.log('b', b)

  const c = ud.getUDSafeAddress()

  console.log('c', c)

  await ud.watchDeployment({
    onLogicDeploy: (event) => console.log('logic deployed!', event.detail.chainId),
    onProxyDeploy: (event) => console.log('Proxy deployed!', event.detail.chainId),
    onSafeDeploy: (event) => console.log('Safe deployed!', event.detail.chainId),
  })
  await ud.watchTokenTransfer({
    onBalanceChange: (event) => console.log('USDC received!', event.detail.chainId),
  })

  await ud.watchSettle({
    onSettleCalled: (event) => console.log('Settle called!', event.detail.chainId),
  })

  await ud.watchAssetReceived({
    onAssetReceived: (event) => console.log(`Adsset receivedzlxll`),
  })
}

main()
