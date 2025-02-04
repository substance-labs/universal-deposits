const { UniversalDeposits } = require('@universal-deposits/sdk')
const { curry, memoizeWith, map } = require('ramda')
const fs = require('fs')

const main = async () => {
  const destinationAddress = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
  const destinationToken = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
  const destinationChain = '100'

  const ud = new UniversalDeposits({
    destinationAddress,
    destinationToken,
    destinationChain,
    urls: [process.env['ETH_RPC_URL']],
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
    onSafeDeploy: (event) => console.log('Safe deployed', event.detail.chainId),
  })
}

main()
