const { UniversalDeposits } = require('@universal-deposits/sdk')

const supportedChainEndpoints = [
  'https://base-mainnet.g.alchemy.com/v2/JXef1SOLQbWO9rSzgH3UAnHILI6GaTCA',
  'https://polygon-mainnet.g.alchemy.com/v2/JXef1SOLQbWO9rSzgH3UAnHILI6GaTCA',
  'https://arb-mainnet.g.alchemy.com/v2/JXef1SOLQbWO9rSzgH3UAnHILI6GaTCA',
  'https://gnosis-mainnet.g.alchemy.com/v2/JXef1SOLQbWO9rSzgH3UAnHILI6GaTCA',
]

const main = () => {
  const ud = new UniversalDeposits({
    destinationAddress: '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6',
    destinationToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E',
    destinationChain: '100',
    checkIntervalMs: 1500,
    urls: supportedChainEndpoints,
    destinationUrl: supportedChainEndpoints[3],
  })

  console.log('Deposit to ', ud.getUDSafeAddress())

  ud.watchTokenTransfer({
    onBalanceChange: (_event) => {
      console.log('Balance changed detected!', _event.detail.chainId)
    },
  })

  ud.watchDeployment({
    onLogicDeploy: (_event) => console.log('onLogicDeploy: ', _event.detail.chainId),
    onProxyDeploy: (_event) => console.log('onProxyDeploy: ', _event.detail.chainId),
    onSafeDeploy: (_event) => console.log('onSafeDeploy: ', _event.detail.chainId),
  })

  ud.watchAssetReceived({ onAssetReceived: () => console.log('Asset received!') })
}

main()
