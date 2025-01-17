import { reset } from '@nomicfoundation/hardhat-network-helpers'
import Safe, {
  SafeAccountConfig,
  SafeConfig,
  SafeProxyFactoryBaseContract,
} from '@safe-global/protocol-kit'
import { expect } from 'chai'
import { BaseContract, JsonRpcProvider, Wallet } from 'ethers'
import hre from 'hardhat'
import { Account, createWalletClient, http, WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'
import { SafeModule, TestToken } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { MetaTransactionData, OperationType } from '@safe-global/types-kit'

const URL = 'http://127.0.0.1:8545'
const CREATEX_ADDRESS = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil
const OWNER = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
const LEGACY_SAFE = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
const SETTLEMENT_MODULE = ''
const SECONDARY_SAFE = '' // To send upon 'Safe Already Deployed' error
const DLN_SOURCE = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66' // deBridge DLN source address
describe('safeModule allowanceManagement', () => {
  let account: Wallet
  let client: WalletClient
  let safeModuleAddress = SETTLEMENT_MODULE
  let safeModule: SafeModule
  let safe: Safe
  let safeAddress = SECONDARY_SAFE
  let token: TestToken
  let tokenAddress: string
  before(async () => {
    const transport = http(URL)
    const chain = arbitrum
    account = new hre.ethers.Wallet(PRIVATE_KEY, new JsonRpcProvider(URL))

    // await reset(URL)
  })

  it('Deploy test token', async () => {
    token = await hre.ethers.deployContract('TestToken', account)
    tokenAddress = await token.getAddress()

    expect(await token.balanceOf(account)).to.be.equal(10000000)
  })

  if (safeModuleAddress === '') {
    it('Deploy SafeModule', async () => {
      const SafeModule = await hre.ethers.getContractFactory('SafeModule')
      safeModule = await hre.upgrades.deployProxy(SafeModule, [OWNER, DLN_SOURCE, tokenAddress])
      safeModuleAddress = await safeModule.getAddress()
      console.log('Safe module deployed @ ', safeModuleAddress)

      expect(await safeModule.owner()).to.be.equal(OWNER)
      expect(await safeModule.autoSettlement(tokenAddress)).to.be.true
    })
  }

  async function maybeDeploySafe(safeConfig: SafeConfig) {
    let protocolKit = await Safe.init(safeConfig)

    if (SECONDARY_SAFE == '') {
      const { from, to, data, value } = await protocolKit.createSafeDeploymentTransaction()
      await account.sendTransaction({ from, to, data, value })
    } else {
      protocolKit = await Safe.init({
        provider: safeConfig.provider,
        signer: safeConfig.signer,
        safeAddress: SECONDARY_SAFE,
      })
    }

    return protocolKit
  }

  if (safeAddress === '') {
    it('Deploy Safe', async () => {
      const threshold = 1
      const owners = [account.address]
      const saltNonce = hre.ethers.concat([LEGACY_SAFE, safeModuleAddress])
      const safeAccountConfig: SafeAccountConfig = { owners, threshold }
      const predictedSafe = { safeAccountConfig, safeDeploymentConfig: { saltNonce } }

      safe = await maybeDeploySafe({
        provider: URL,
        signer: account.address,
        predictedSafe,
      })

      safeAddress = await safe.getAddress()
      console.log('Safe deployed @', safeAddress)
      expect(await safe.getOwners()).to.include(account.address)
    })

    it('Add the module', async () => {
      safe = await Safe.init({ provider: URL, signer: account.address, safeAddress })

      expect(await safe.isModuleEnabled(safeModuleAddress)).to.be.false

      const safeTx = await safe.createEnableModuleTx(safeModuleAddress)
      await safe.executeTransaction(safeTx)

      expect(await safe.isModuleEnabled(safeModuleAddress)).to.be.true
    })

    it('Transfer ownership', async () => {
      const accountAddress = await account.getAddress()
      expect(await safe.getOwners()).to.not.include(OWNER)
      const safeTx = await safe.createAddOwnerTx({ ownerAddress: OWNER })
      await safe.executeTransaction(safeTx)
      const safeTx2 = await safe.createRemoveOwnerTx({ ownerAddress: accountAddress, threshold: 1 })
      await safe.executeTransaction(safeTx2)

      expect(await safe.getOwners()).to.include(OWNER)
      expect(await safe.getOwners()).to.have.length(1)
      expect(await safe.getOwners()).to.not.include(accountAddress)
    })

    it('Enable autosettle', async () => {
      const tokenAddress = await token.getAddress()
      const toggleAutoSettlementTx =
        await safeModule.toggleAutoSettlement.populateTransaction(tokenAddress)

      const txs: MetaTransactionData[] = [
        {
          to: toggleAutoSettlementTx.to,
          value: '0',
          data: toggleAutoSettlementTx.data,
          operation: OperationType.Call,
        },
      ]
      let safeTx = await safe.createTransaction({ transactions: txs })
      safeTx = await safe.signTransaction(safe)
      await safe.executeTransaction(safeTx)
      expect(safeModule.autoSettlement(tokenAddress)).to.be.true
    })
  }

  // it('hello', async () => {
  //   const c = createPublicClient({ chain: arbitrum, transport: http(url) })

  //   console.log(await c.getBalance({ address: account.address }))

  //   const balance = await protocolKit.getBalance()
  //   const safeAddress = await protocolKit.getAddress()

  //   console.log()

  //   console.log('balance', balance)
  //   console.log('address', safeAddress)

  //   expect(await protocolKit.isOwner(account.address)).to.be.true

  //   console.log('dlnSource balance', await c.getBalance({ address: dlnSource }))
  //   let safeModule: BaseContract | undefined
  //   try {
  //     const SafeModule = await ethers.getContractFactory('SafeModule')
  //     safeModule = await upgrades.deployProxy(SafeModule, [owner, dlnSource])
  //   } catch (e) {
  //     if (e instanceof Error) {
  //       console.log(e.message)
  //     }
  //   }
  //   console.log('SafeModule address: ', await safeModule?.getAddress())

  //   await client.sendTransaction({
  //     to: safeAddress as `0x${string}`,
  //     value: parseUnits('0.1', 18),
  //     gasLimit: 1200,
  //   })

  //   console.log('balance', await protocolKit.getBalance())

  //   const moduleAddress = await safeModule?.getAddress()
  //   console.log('SafeModule address', moduleAddress)
  //   if (!(await protocolKit.isModuleEnabled(moduleAddress))) {
  //     // const options: SafeTransactionOptionalProps = {
  //     //   safeTxGas: '123', // Optional
  //     //   baseGas: '123', // Optional
  //     //   gasPrice: '123', // Optional
  //     //   gasToken: '0x...', // Optional
  //     //   refundReceiver: '0x...', // Optional
  //     //   nonce: 123, // Optional
  //     // }

  //     const safeTransaction = await protocolKit.createEnableModuleTx(moduleAddress)
  //     const tx = await protocolKit.executeTransaction(safeTransaction)

  //     console.log(tx)
  //   }
  // })
})
