const composableCoWAbi = [
  {
    type: 'event',
    name: 'ConditionalOrderCreated',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'params',
        type: 'tuple',
        indexed: false,
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        components: [
          {
            name: 'handler',
            type: 'address',
            internalType: 'contract IConditionalOrder',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'staticInput',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'getTradeableOrderWithSignature',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        components: [
          { name: 'handler', type: 'address', internalType: 'contract IConditionalOrder' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
          { name: 'staticInput', type: 'bytes', internalType: 'bytes' },
        ],
      },
      { name: 'offchainInput', type: 'bytes', internalType: 'bytes' },
      { name: 'proof', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct GPv2Order.Data',
        components: [
          { name: 'sellToken', type: 'address', internalType: 'contract IERC20' },
          { name: 'buyToken', type: 'address', internalType: 'contract IERC20' },
          { name: 'receiver', type: 'address', internalType: 'address' },
          { name: 'sellAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'buyAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'validTo', type: 'uint32', internalType: 'uint32' },
          { name: 'appData', type: 'bytes32', internalType: 'bytes32' },
          { name: 'feeAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'kind', type: 'bytes32', internalType: 'bytes32' },
          { name: 'partiallyFillable', type: 'bool', internalType: 'bool' },
          { name: 'sellTokenBalance', type: 'bytes32', internalType: 'bytes32' },
          { name: 'buyTokenBalance', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    stateMutability: 'view',
  },
]

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

const Gpv2OrderDataAbi = [
  { name: 'sellToken', type: 'address' },
  { name: 'buyToken', type: 'address' },
  { name: 'receiver', type: 'address' },
  { name: 'sellAmount', type: 'uint256' },
  { name: 'buyAmount', type: 'uint256' },
  { name: 'validTo', type: 'uint32' },
  { name: 'appData', type: 'bytes32' },
  { name: 'feeAmount', type: 'uint256' },
  { name: 'kind', type: 'bytes32' },
  { name: 'partiallyFillable', type: 'bool' },
  { name: 'sellTokenBalance', type: 'bytes32' },
  { name: 'buyTokenBalance', type: 'bytes32' },
]

module.exports = {
  composableCoWAbi,
  safeModuleProxyAbi,
  dlnSourceAbi,
  Gpv2OrderDataAbi,
}
