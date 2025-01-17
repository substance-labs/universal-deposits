import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import hre from 'hardhat'

import { ISafeTest__factory, TestToken, TestToken__factory } from '../../typechain-types'

import deploySafeProxy from './deploySafeProxy'
import deploySingletons from './deploySingletons'
import execSafeTransaction from './execSafeTransaction'
import { parseUnits } from 'ethers'

async function deploySafeModule(owner: SignerWithAddress) {
  const factory = await hre.ethers.getContractFactory('SafeModule')
  return hre.upgrades.deployProxy(factory, [owner.address], { initializer: 'initialize(address)' })
}

export default async function setup() {
  const [owner, alice, bob, deployer, relayer] = await hre.ethers.getSigners()

  const { safeProxyFactoryAddress, safeMastercopyAddress } = await deploySingletons(deployer)

  const safeAddress = await deploySafeProxy(
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    owner.address,
    deployer,
  )
  const safeModule = await deploySafeModule(owner)
  const safeModuleAddress = safeModule.getAddress()
  const token = await deployTestToken(deployer)

  // both the safe and the allowance work by signature
  // connect the contracts to a signer that has funds
  // but isn't safe owner, or allowance spender
  const safe = ISafeTest__factory.connect(safeAddress, relayer)

  // Funds the safe
  await owner.sendTransaction({ to: safeAddress, value: parseUnits('1', 18) })

  // fund the safe
  await token.transfer(safeAddress, 1000)

  // enable Allowance as mod
  await execSafeTransaction(
    safe,
    await safe.enableModule.populateTransaction(safeModuleAddress),
    owner,
  )

  return {
    // the deployed safe
    safe,
    // singletons
    safeModule,
    // test token
    token,
    // some signers
    owner,
    alice,
    bob,
  }
}

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory('TestToken', minter)
  return await factory.connect(minter).deploy()
}
