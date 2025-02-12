const envPath = process.env.ENV_PATH
require('dotenv').config({ path: envPath || '.env' })
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
  concat,
  encodePacked,
} = require('viem')
const { monitorFile } = require('./lib/monitor-file')
const { UniversalDeposits } = require('@universal-deposits/sdk')
const { privateKeyToAccount } = require('viem/accounts')
const { logger } = require('./lib/get-logger')

const DEFAULT_EX_RATE = 10000
const CONFIG = {
  addressesPath: process.env['PATH_ADDRESSES'],
  tokensPath: process.env['PATH_TOKENS'],
  originChainId: process.env['ORIGIN_CHAIN'],
  destinationChain: process.env['DESTINATION_CHAIN'],
  destinationToken: process.env['DESTINATION_TOKEN'],
  url: process.env['URL'],
  broadcast: process.env['BROADCAST'] === 'true' || false,
  freq: process.env['CHECK_FREQUENCY'] || 1000,
  privateKey: process.env['PRIVATE_KEY'] || null,
}

const safeModuleProxyAbi = [
  {
    type: 'function',
    name: 'setExchangeRate',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'exchangeRate', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'toggleAutoSettlement',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
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
  {
    type: 'function',
    name: 'autoSettlement',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
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
// deploy.js <addressesPath> <originTokensPath> <originChainId> <destinationChain> <destinationToken> <destinationChain> <url>
const getBalanceAbiItem = {
  name: 'getBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ type: 'address' }],
  outputs: [{ type: 'uint256' }],
}

const toString = R.invoker(0, 'toString')

const readMultilineFile = _path =>
  fs.readFile(_path).then(toString).then(R.trim).then(R.split('\n'))

let UD_SAFES = {} // Maps a destination address to its UD safe address
let TOKENS = [] // Array of token and relative ex rate (ie. [ { address: 0x..., exrate: 9200 } ])
let INTERVALS = []

const getTokenAccountBalances = async _config => {
  const client = createPublicClient({
    chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
    transport: http(_config.url),
    batch: { multicall: true },
  })

  const contracts = await Promise.all(
    TOKENS.map(_token => ({
      ..._token, // expands address and exRate
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

  const checkErrors = _results => {
    for (let result of _results) {
      if (R.has('error', result[1])) {
        logger.error(result[1].error.shortMessage)
        logger.error(result[1].error.details)
        return Promise.reject(new Error('Error when checking balance'))
      }
    }

    return Promise.resolve(_results)
  }

  return await client
    .multicall({ contracts })
    .then(R.zip(contracts)) // merge the contract and result together
    .then(checkErrors)
    .then(
      R.map(x => ({
        exRate: x[0].exRate,
        token: x[0].address,
        safe: x[0].args[0],
        balance: x[1].result,
      })),
    )
    .then(R.filter(x => x.balance > 0))
}

const getTokenAccountUDSafes = R.curry(async (_config, _addresses) => {
  const destinationChain = _config.destinationChain
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

const getTokensAndExRates = (_config, _tokensLines) =>
  Promise.all(_tokensLines.map(_line => _line.split(':'))).then(
    R.map(R.zipObj(['address', 'exRate'])),
  )

const updateGlobals = _config =>
  Promise.all([readMultilineFile(_config.tokensPath), readMultilineFile(_config.addressesPath)])
    .then(([_tokens, _addresses]) => [
      Array.from(new Set(_tokens)),
      Array.from(new Set(_addresses)),
    ])
    .then(([_tokens, _addresses]) =>
      Promise.all([
        getTokensAndExRates(_config, _tokens),
        getTokenAccountUDSafes(_config, _addresses),
      ]),
    )
    .then(([_tokens, _safes]) => {
      logger.info('Updating globals...')
      logger.info(`  TOKENS: from ${TOKENS.length} elements to ${_tokens.length} elements`)
      logger.info(
        `  UD_SAFES: from ${R.keys(UD_SAFES).length} elements to ${R.keys(_safes).length} elements`,
      )
      TOKENS = _tokens
      UD_SAFES = _safes

      R.keys(UD_SAFES).map(_key => logger.info(`    ${_key}: ${UD_SAFES[_key]}`))

      logger.info('Globals updated!')
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
  _destinationChain,
  _originToken,
  _exchangeRate,
) =>
  runShellCommand([
    'forge',
    [
      'script',
      '--skip-simulation',
      '--no-storage-caching',
      '--gas-price',
      '50000000000',
      '--gas-estimate-multiplier',
      '150',
      './contracts/scripts/DeploymentService.s.sol',
      '--account',
      'deployer', // FIXME: this will break on another machine
      '--sender',
      '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915',
      '--password',
      '',
      _config.broadcast ? '--broadcast' : '',
      '--rpc-url',
      _config.url,
      '--sig',
      'run(uint256,address,address,address,uint256)',
      _exchangeRate,
      _originToken,
      _destinationAddress,
      _destinationToken,
      _destinationChain,
    ],
    { cwd: '../evm' },
  ]).then(_ => new Promise(resolve => setTimeout(resolve, 1000))) // FIXME: this is to wait for the deployment to finish

// const deployContracts = (_config, _originToken, _exchangeRate) => {
//   const CreateX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'
//   const SAFEMODULE_SALT = 'universal-deposits'
//   const CREATEX_REDEPLOY_PROTECTION_FLAG = '0x00'
//   const saltBytes = concat(encodePacked(SAFEMODULE_SALT), CREATEX_REDEPLOY_PROTECTION_FLAG)

//   logger.info('Saltbytes', saltBytes)

//   // bytes memory saltBytes = bytes.concat(
//   //   abi.encodePacked(SAFEMODULE_SALT),
//   //   CREATEX_REDEPLOY_PROTECTION_FLAG
//   // );

//   // salt = bytes32(saltBytes);

//   // initCode = abi.encodePacked(type(SafeModule).creationCode);

//   // if (previousLogic == address(0)) {
//   //   expected = CreateX.computeCreate2Address(
//   //     keccak256(abi.encode(salt)),
//   //     keccak256(initCode),
//   //     address(CreateX)
//   //   );
//   // } else {
//   //   expected = previousLogic;
//   // }
// }

const isAutoSettlementEnabled = async ({ address, publicClient, token }) => {
  logger.info(`  Checking auto settlement for token ${token} is enabled...`)
  return await publicClient.readContract({
    address,
    abi: safeModuleProxyAbi,
    functionName: 'autoSettlement',
    args: [token],
  })
}

const toggleAutoSettlement = async ({
  address,
  account,
  publicClient,
  walletClient,
  token,
  exchangeRate,
}) => {
  logger.info('  Enabling auto settlement for token', token)
  const { request } = await publicClient.simulateContract({
    address,
    abi: safeModuleProxyAbi,
    functionName: 'toggleAutoSettlement',
    args: [token],
    account,
  })

  let hash = await walletClient.writeContract(request)
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 })
  logger.info('  Broadcasted @', hash)
  logger.info('  Setting exchange rate to', exchangeRate)
  const { request: request2 } = await publicClient.simulateContract({
    address,
    abi: safeModuleProxyAbi,
    functionName: 'setExchangeRate',
    args: [token, exchangeRate],
    account,
  })

  hash = await walletClient.writeContract(request2)
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 })
  logger.info(`  Broadcasted @`, hash)
  logger.info('  Exchange rate set successfully')
}

const getGlobalFixedNativeFee = async ({ publicClient }) => {
  const dlnSource = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
  return await publicClient.readContract({
    address: dlnSource,
    abi: dlnSourceAbi,
    functionName: 'globalFixedNativeFee',
  })
}

const settle = async ({ address, account, publicClient, walletClient, value, safe, token }) => {
  logger.info('Calling settle for token', token)
  const { request } = await publicClient.simulateContract({
    address,
    abi: safeModuleProxyAbi,
    functionName: 'settle',
    args: [safe, token],
    value,
    account,
    gas: 600000,
  })
  const hash = await walletClient.writeContract(request)
  logger.info(`  Broadcasted @`, hash)
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 })
}

const maybeDeployUDSafes = R.curry(async (_config, _tokensAccountBalances) => {
  const reverseUDSafeMapping = R.invertObj(UD_SAFES)
  if (_tokensAccountBalances.length > 0) {
    logger.info(`Detected ${_tokensAccountBalances.length} UD safes with balance ≠ 0...`)
  } else {
    logger.debug(`Detected ${_tokensAccountBalances.length} UD safes with balance ≠ 0...`)
  }
  for (var i = _tokensAccountBalances.length - 1; i >= 0; i--) {
    const entry = _tokensAccountBalances[i]
    const destinationAddress = reverseUDSafeMapping[entry.safe]
    const destinationToken = _config.destinationToken
    const destinationChain = _config.destinationChain

    logger.info(`  ${destinationAddress} => ${entry.safe} (${entry.balance} ${entry.token})`)
    const account = privateKeyToAccount(_config.privateKey)

    const walletClient = createWalletClient({
      chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
      transport: http(_config.url),
      account,
    })
    const publicClient = createPublicClient({
      chain: extractChain({ id: parseInt(_config.originChainId), chains: R.values(chains) }),
      transport: http(_config.url),
      batch: { multicall: true },
    })

    const code = await publicClient.getBytecode({ address: entry.safe })

    if (!code) {
      logger.info(`  Safe ${entry.safe} not found on chain, deploying...`)
      await deployContractWithForge(
        _config,
        destinationAddress,
        destinationToken,
        destinationChain,
        entry.token,
        entry.exRate || DEFAULT_EX_RATE,
      )
    } else {
      logger.info(`  Already found a contract for ${entry.safe}, calling settle...`)
      const address = new UniversalDeposits({
        destinationAddress,
        destinationToken,
        destinationChain,
      }).getSafeModuleProxyAddress()

      const autoSettlementEnabled = await isAutoSettlementEnabled({
        publicClient,
        address,
        token: entry.token,
      })

      if (!autoSettlementEnabled) {
        logger.info('  Auto settlement disabled for token', entry.token)
        await toggleAutoSettlement({
          address,
          account,
          publicClient,
          walletClient,
          token: entry.token,
          exchangeRate: entry.exRate || DEFAULT_EX_RATE,
        })
      } else {
        logger.info('  Auto settlement enabled for token', entry.token)
      }

      let protocolFee = 0
      if (entry.token !== destinationToken || _config.originChainId !== destinationChain) {
        protocolFee = await getGlobalFixedNativeFee({ publicClient })
      }
      logger.info('  Protocol fee', protocolFee)

      await settle({
        publicClient,
        walletClient,
        address,
        account,
        value: protocolFee,
        safe: entry.safe,
        token: entry.token,
      })
    }

    await logger.info('  Done')
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
    INTERVALS.push(setInterval(deploymentLoop, _config.freq, _config))
    INTERVALS.push(monitorFile(_config.addressesPath, 3, updateGlobals, [_config]))
  })

process.on('unhandledRejection', _error => {
  // Cleanup
  INTERVALS.map(x => clearInterval(x))
  logger.info(`Removing ${INTERVALS.length} intervals...`)
  INTERVALS = []
  logger.error('General error:', _error)
  logger.info('Intervals cleared!')
  logger.info('Resuming in 5s...')
  setTimeout(main, 5000, CONFIG)
})

main(CONFIG)
