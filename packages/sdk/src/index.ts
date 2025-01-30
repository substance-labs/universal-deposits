import { Address } from 'viem'

import { UniversalDeposits } from './lib/ud'

const getUDAddress = (destinationAddress: Address) => {
  // const destinationAddress = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
  const destinationToken = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
  const destinationChain = BigInt('100000002')

  const ud = new UniversalDeposits({
    destinationAddress,
    destinationToken,
    destinationChain,
  })

  return ud.getUDSafeAddress()
}

export default getUDAddress
