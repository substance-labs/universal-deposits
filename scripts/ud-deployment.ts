// An example script that shows how to interact programmatically with a deployed contract
// You must customise it according to your contract's specifications
import hre from 'hardhat'

const ADDRESS_DEFAULT_LEGACY_SAFE = '0xf9A9e6288c7A23B2b07f06f668084A1101835fA6'
const ADDRESS_CREATEX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'
const ADDRESS_DLN_SOURCE = '0xef4fb24ad0916217251f553c0596f8edc630eb66'
const ADDRESS_USDC_ARBITRUM = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
const ADDRESS_USDC_GNOSIS = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'
const ADDRESS_EURe_GNOSIS = '0xcb444e90d8198415266c6a2724b7900fb12fc56e'

const deploySSModule = (_legacyAddress) =>
  new Promise((resolve, reject) => {
    const SafeModule = await hre.ethers.getContractFactory('SafeModule')
    const initializeData = await SafeModule.interface.encodeFunctionData('initialize', [
      _legacyAddress,
      _add,
    ])
  })

const main = (_legacyAddress = ADDRESS_DEFAULT_LEGACY_SAFE) => deploySSModule(_legacyAddress)
// .then(deployUDSafe)
// .then()

// To run it, invoke `npx hardhat run scripts/interact.ts --network <network_name>`
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
