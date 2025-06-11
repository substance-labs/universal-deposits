// store all the configuration here
const CONFIG = {
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || '0x',
  SETTLER_PRIATE_KEY: process.env.SETTLER_PRIVATE_KEY || '0x',
}

const bridgeConfigs = [
  {
    name: 'lifi',
    enabled: true,
    apiKey: process.env.LIFI_API_KEY, // Optional
    timeout: 30000, // Timeout in ms
  },
  {
    name: 'debridge',
    enabled: true,
  },
  {
    name: 'relay',
    enabled: false,
  },
]

export { CONFIG, bridgeConfigs }
