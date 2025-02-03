const fs = require('fs/promises')
const R = require('ramda')
const util = require('node:util')
const execFile = util.promisify(require('node:child_process').execFile)
const chains = require('viem/chains')
const {
  createPublicClient,
  http,
  erc20Abi,
  ClientChainNotConfiguredError,
  getContract,
  createWalletClient,
  extractChain,
} = require('viem')
const { UniversalDeposits } = require('@universal-deposits/sdk')
const { privateKeyToAccount } = require('viem/accounts')

const settleAbi = [
  {
    type: 'function',
    name: 'settle',
    inputs: [
      { name: 'safe', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
]

const dlnSourceAbi = [
  {
    type: 'function',
    name: 'globalFixedNativeFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint88', internalType: 'uint88' }],
    stateMutability: 'nonpayable',
  },
]

// Usage
// deploy.js <addressesPath> <originTokensPath> <originChainId> <destinationChainId> <destinationToken> <destinationChain> <url>
const getBalanceAbiItem = {
  name: 'getBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ type: 'address' }],
  outputs: [{ type: 'uint256' }],
}

const toString = R.invoker(0, 'toString')

const readMultilineFile = _path => fs.readFile(_path).then(toString).then(R.split('\n'))

let UD_SAFES = {} // Maps a destination address to its UD safe address
let TOKENS = {} // Origing tokens to watch out for deposits

const debridgeChainIdMapping = {
  10200: 100000002,
  // TODO: add other debridge chain ids here
}

const getTokenAccountBalances = async _config => {
  const client = createPublicClient({
    chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
    transport: http(_config.url),
    batch: { multicall: true },
  })

  const contracts = await Promise.all(
    TOKENS.map(address => ({
      address,
      abi: erc20Abi,
    })),
  )
    .then(_contracts =>
      Promise.all(
        _contracts.map(_contract =>
          Promise.all(
            R.values(UD_SAFES).map(_safe => ({
              ..._contract,
              functionName: 'balanceOf',
              args: [_safe],
            })),
          ),
        ),
      ),
    )
    .then(R.flatten)

  return await client
    .multicall({ contracts })
    .then(R.zip(contracts))
    .then(
      R.map(x => ({
        token: x[0].address,
        safe: x[0].args[0],
        balance: x[1].result,
      })),
    )
    .then(R.filter(x => x.balance > 0))
}

const getTokenAccountUDSafes = R.curry(async (_config, _addresses) => {
  const destinationChain = debridgeChainIdMapping[_config.destinationChainId]
  const destinationToken = _config.destinationToken
  return Promise.resolve(
    _addresses.reduce(
      (result, destinationAddress) =>
        R.assoc(
          destinationAddress,
          new UniversalDeposits({
            destinationAddress,
            destinationToken,
            destinationChain,
          }).getUDSafeAddress(),
          result,
        ),
      {},
    ),
  )
})

const updateGlobals = _config =>
  Promise.all([readMultilineFile(_config.tokensPath), readMultilineFile(_config.addressesPath)])
    .then(([_tokens, _addresses]) =>
      Promise.all([_tokens, getTokenAccountUDSafes(_config, _addresses)]),
    )
    .then(([_tokens, _safes]) => {
      TOKENS = _tokens
      UD_SAFES = _safes
    })

const runShellCommand = _args =>
  execFile(..._args).then(({ stdout, stderr }) => {
    if (stderr) return Promise.reject(new Error(stderr))

    return Promise.resolve(true)
  })

const deployContractWithForge = (
  _config,
  _destinationAddress,
  _destinationToken,
  _destinationChainId,
  _originToken,
  _exchangeRate,
) =>
  runShellCommand([
    'forge',
    [
      'script',
      './contracts/scripts/DeploymentService.s.sol',
      '--rpc-url',
      _config.url,
      '--sig',
      'run(uint256,address,address,address,uint256)',
      _exchangeRate,
      _originToken,
      _destinationAddress,
      _destinationToken,
      _destinationChainId,
      _config.broadcast ? '--broadcast' : '',
    ],
  ]).then(_ => new Promise(resolve => setTimeout(resolve, 1000))) // FIXME: this is to wait for the deployment to finish

const maybeDeployUDSafes = R.curry(async (_config, _tokensAccountBalances) => {
  const reverseUDSafeMapping = R.invertObj(UD_SAFES)
  console.log(`Detected ${_tokensAccountBalances.length} UD safes with balance ≠ 0...`)
  for (var i = _tokensAccountBalances.length - 1; i >= 0; i--) {
    const entry = _tokensAccountBalances[i]
    const destinationAddress = reverseUDSafeMapping[entry.safe]
    const destinationToken = _config.destinationToken
    const destinationChain = debridgeChainIdMapping[_config.destinationChainId].toString()
    const exchangeRate = 9200 // TODO: cofigurable
    console.log(`  ${destinationAddress} => ${entry.safe} (${entry.balance} ${entry.token})`)
    const account = privateKeyToAccount(_config.privateKey)

    const wclient = createWalletClient({
      chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
      transport: http(_config.url),
      account,
    })
    const pclient = createPublicClient({
      chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
      transport: http(_config.url),
      batch: { multicall: true },
    })

    const code = await pclient.getBytecode({ address: entry.safe })

    if (!code) {
      console.log(`  Safe ${entry.safe} not found on chain, deploying...`)
      await deployContractWithForge(
        _config,
        destinationAddress,
        destinationToken,
        entry.token,
        exchangeRate,
      )
    } else {
      console.log(`  Already found a contract for ${entry.safe}, calling settle...`)
      const dlnSource = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
      const protocolFee = await pclient.readContract({
        address: dlnSource,
        abi: dlnSourceAbi,
        functionName: 'globalFixedNativeFee',
      })

      console.log('Protoicol fee', protocolFee)
      const address = new UniversalDeposits({
        destinationAddress,
        destinationToken,
        destinationChain,
      }).getSafeModuleProxyAddress()

      const { request } = await pclient.simulateContract({
        address,
        abi: settleAbi,
        functionName: 'settle',
        args: [entry.safe, entry.token],
        value: protocolFee,
        account,
      })

      const hash = await wclient.writeContract(request)

      const receipt = await wclient.waitForTransactionReceipt({ hash })
    }

    await console.log('  Done')
  }
})

let locked = false

const deploymentLoop = async (_config, _intervalId) => {
  if (locked) {
    return
  }

  try {
    locked = true
    await getTokenAccountBalances(_config).then(maybeDeployUDSafes(_config))
  } finally {
    locked = false
  }
}

const main = _config =>
  updateGlobals(_config).then(_ => {
    setInterval(deploymentLoop, _config.freq, _config)
  })

main({
  addressesPath: process.argv[2],
  tokensPath: process.argv[3],
  originChainId: process.argv[4],
  destinationChainId: process.argv[5],
  destinationToken: process.argv[6],
  url: process.argv[7],
  broadcast: true,
  freq: process.env['CHECK_FREQUENCY'] || 5000,
  privateKey: process.env['PRIVATE_KEY'] || null,
})
