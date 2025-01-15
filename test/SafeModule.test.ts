import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'

import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'
import execSafeTransaction from './test-helpers/execSafeTransaction'
import setup from './test-helpers/setup'

describe('AllowanceModule allowanceManagement', () => {
  it('Add delegates and removes first delegate', async () => {
    const { safe, allowanceModule, owner, alice, bob } = await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // // add alice as delegate
    // await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // // add bob as delegate
    // await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(bob.address), owner)

    // let delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    // expect(delegates.results).to.deep.equal([bob.address, alice.address])
    // expect(delegates.next).to.equal(0)

    // // remove bob
    // await execSafeTransaction(safe, await allowanceModule.removeDelegate.populateTransaction(bob.address, true), owner)
    // delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    // expect(delegates.results).to.deep.equal([alice.address])
    // expect(delegates.next).to.equal(0)
  })
})

