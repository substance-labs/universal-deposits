// TODO: read ABI from SDK

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

const CreateXAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'emitter',
        type: 'address',
      },
    ],
    name: 'FailedContractCreation',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'emitter',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'revertData',
        type: 'bytes',
      },
    ],
    name: 'FailedContractInitialisation',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'emitter',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'revertData',
        type: 'bytes',
      },
    ],
    name: 'FailedEtherTransfer',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'emitter',
        type: 'address',
      },
    ],
    name: 'InvalidNonceValue',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'emitter',
        type: 'address',
      },
    ],
    name: 'InvalidSalt',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
    ],
    name: 'ContractCreation',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    name: 'ContractCreation',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
    ],
    name: 'Create3ProxyContractCreation',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'initCodeHash',
        type: 'bytes32',
      },
    ],
    name: 'computeCreate2Address',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'initCodeHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'deployer',
        type: 'address',
      },
    ],
    name: 'computeCreate2Address',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'deployer',
        type: 'address',
      },
    ],
    name: 'computeCreate3Address',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
    ],
    name: 'computeCreate3Address',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'nonce',
        type: 'uint256',
      },
    ],
    name: 'computeCreateAddress',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'deployer',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'nonce',
        type: 'uint256',
      },
    ],
    name: 'computeCreateAddress',
    outputs: [
      {
        internalType: 'address',
        name: 'computedAddress',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
    ],
    name: 'deployCreate',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
    ],
    name: 'deployCreate2',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
    ],
    name: 'deployCreate2',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'refundAddress',
        type: 'address',
      },
    ],
    name: 'deployCreate2AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
    ],
    name: 'deployCreate2AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'refundAddress',
        type: 'address',
      },
    ],
    name: 'deployCreate2AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
    ],
    name: 'deployCreate2AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'deployCreate2Clone',
    outputs: [
      {
        internalType: 'address',
        name: 'proxy',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'deployCreate2Clone',
    outputs: [
      {
        internalType: 'address',
        name: 'proxy',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
    ],
    name: 'deployCreate3',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
    ],
    name: 'deployCreate3',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
    ],
    name: 'deployCreate3AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
    ],
    name: 'deployCreate3AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'salt',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'refundAddress',
        type: 'address',
      },
    ],
    name: 'deployCreate3AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'refundAddress',
        type: 'address',
      },
    ],
    name: 'deployCreate3AndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
    ],
    name: 'deployCreateAndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initCode',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'constructorAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'initCallAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct CreateX.Values',
        name: 'values',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'refundAddress',
        type: 'address',
      },
    ],
    name: 'deployCreateAndInit',
    outputs: [
      {
        internalType: 'address',
        name: 'newContract',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'deployCreateClone',
    outputs: [
      {
        internalType: 'address',
        name: 'proxy',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
]

const SafeProxyFactoryAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'contract SafeProxy', name: 'proxy', type: 'address' },
      { indexed: false, internalType: 'address', name: 'singleton', type: 'address' },
    ],
    name: 'ProxyCreation',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address', name: '_singleton', type: 'address' },
      { internalType: 'bytes', name: 'initializer', type: 'bytes' },
      { internalType: 'uint256', name: 'saltNonce', type: 'uint256' },
    ],
    name: 'createChainSpecificProxyWithNonce',
    outputs: [{ internalType: 'contract SafeProxy', name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_singleton', type: 'address' },
      { internalType: 'bytes', name: 'initializer', type: 'bytes' },
      { internalType: 'uint256', name: 'saltNonce', type: 'uint256' },
      { internalType: 'contract IProxyCreationCallback', name: 'callback', type: 'address' },
    ],
    name: 'createProxyWithCallback',
    outputs: [{ internalType: 'contract SafeProxy', name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_singleton', type: 'address' },
      { internalType: 'bytes', name: 'initializer', type: 'bytes' },
      { internalType: 'uint256', name: 'saltNonce', type: 'uint256' },
    ],
    name: 'createProxyWithNonce',
    outputs: [{ internalType: 'contract SafeProxy', name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getChainId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proxyCreationCode',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'pure',
    type: 'function',
  },
]

const SafeModuleLogicAbi = [
  {
    name: 'initialize',
    type: 'function',
    inputs: [
      { name: '_destinationAddress', type: 'address' },
      { name: '_destinationToken', type: 'address' },
      { name: '_destinationChain', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'toggleAutoSettlement',
    type: 'function',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setExchangeRate',
    type: 'function',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_rate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'settle',
    type: 'function',
    inputs: [
      { name: '_safe', type: 'address' },
      { name: '_token', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'setSettlementChainIds',
    type: 'function',
    inputs: [
      { name: '_destinationChain', type: 'uint256' },
      { name: '_settlementChain', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setDomain',
    type: 'function',
    inputs: [{ name: '_safe', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'autoSettlement',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'rates',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
]

const SafeLogicAbi = [
  {
    name: 'setup',
    type: 'function',
    inputs: [
      { name: '_owners', type: 'address[]' },
      { name: '_threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'isModuleEnabled',
    type: 'function',
    inputs: [{ name: 'module', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
]

export {
  composableCoWAbi,
  SafeModuleLogicAbi,
  dlnSourceAbi,
  Gpv2OrderDataAbi,
  CreateXAbi,
  SafeProxyFactoryAbi,
  SafeLogicAbi,
}
