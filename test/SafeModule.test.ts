import Safe, { SafeAccountConfig } from '@safe-global/protocol-kit'
import { Account, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

describe('safeModule allowanceManagement', () => {
  let url: string
  let account: Account
  before(async () => {
    url = 'http://127.0.0.1:8545'
    account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') // anvil fork
    // const blockToForkFrom = 295976000 // 2025-01-15
    // await reset(url, blockToForkFrom)

    // await setBalance(account.address, parseUnits('1', 18))
  })

  it('hello', async () => {
    const owner = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
    const legacySafe = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
    const safeAccountConfig: SafeAccountConfig = {
      owners: [owner],
      threshold: 1,
      // Additional optional parameters can be included here
    }

    const predictedSafe = {
      safeAccountConfig,
      safeDeploymentConfig: {
        saltNonce: legacySafe, // optional parameter
      },
    }

    const provider = url

    const client = createWalletClient({
      account,
      chain: arbitrum,
      transport: http(url),
    })

    const protocolKit = await Safe.init({
      provider,
      signer: account.address,
      predictedSafe,
    })

    try {
      const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()
      await client.sendTransaction({
        to: deploymentTransaction.to as `0x${string}`,
        value: BigInt(deploymentTransaction.value),
        data: deploymentTransaction.data as `0x${string}`,
      })
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message)
      }
    }

    const c = createPublicClient({ chain: arbitrum, transport: http(url) })

    console.log(await c.getBalance({ address: account.address }))
  })
})
