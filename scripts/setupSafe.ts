import hre from 'hardhat'

// function delay(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms))
// }

const URL = 'http://localhost:8545'
const ADDRESS_SAFE = '0xAD682c03af76Cb5634c8bE58101403e5e754602f'
const ADDRESS_SS_MODULE = '0x4e75d04e7B0a6432b7848634C32346daf5eFfeE1'
const ADDRESS_TOKEN = '0x2B5757720f361559fe0C499C55eFa65bd6bC6cA3'
const PRIVATE_KEY = process.env['OWNER_PRIVATE_KEY']
async function main() {
  const owner = new hre.ethers.Wallet(PRIVATE_KEY, new JsonRpcProvider(URL))
  const ownerAddress = await account.getAddress()
  console.log('owner @', ownerAddress)
  const safe = await Safe.init({
    provider: URL,
    signer: ownerAddress,
    safeAddress: ADDRESS_SAFE,
  })

  // const constructorArgs = ['Hello, Hardhat!']
  // const contract = await hre.ethers.deployContract('Greeter', constructorArgs)

  // await contract.waitForDeployment()
  // const contractAddress = await contract.getAddress()

  // console.log('Greeter deployed to: ' + `${GREEN}${contractAddress}${RESET}\n`)

  // console.log(
  //   'Waiting 30 seconds before beginning the contract verification to allow the block explorer to index the contract...\n',
  // )
  // await delay(30000) // Wait for 30 seconds before verifying the contract

  // await hre.run('verify:verify', {
  //   address: contractAddress,
  //   constructorArguments: constructorArgs,
  // })

  // // Uncomment if you want to enable the `tenderly` extension
  // // await hre.tenderly.verify({
  // //   name: "Greeter",
  // //   address: contractAddress,
  // // });
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
