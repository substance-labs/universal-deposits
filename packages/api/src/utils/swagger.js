import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Universal Deposits API',
      version: '1.0.0',
      description:
        'API for Universal Deposits service that facilitates cross-chain token transfers',
      contact: {
        name: 'Universal Deposits Team',
      },
      license: {
        name: 'Private',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API endpoint',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'INVALID_CHAIN_ID',
                },
                message: {
                  type: 'string',
                  example: 'Unsupported chain ID: 999',
                },
                details: {
                  type: 'object',
                  example: {},
                },
              },
            },
          },
        },
        UDSafeAddress: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                udSafeAddress: {
                  type: 'string',
                  example: '0x1234567890abcdef1234567890abcdef12345678',
                },
                destinationToken: {
                  type: 'string',
                  example: '0xabcdef1234567890abcdef1234567890abcdef12',
                },
                destinationChain: {
                  type: 'number',
                  example: 100,
                },
                destinationAddress: {
                  type: 'string',
                  example: '0x7890abcdef1234567890abcdef1234567890abcd',
                },
              },
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                orderId: {
                  type: 'string',
                  example: '0x1234567890abcdef1234567890abcdef12345678',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'completed', 'failed'],
                  example: 'pending',
                },
                sourceChain: {
                  type: 'number',
                  example: 1,
                },
                destinationChain: {
                  type: 'number',
                  example: 100,
                },
                amount: {
                  type: 'string',
                  example: '1000000000000000000',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2025-06-07T12:00:00Z',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2025-06-07T12:05:00Z',
                },
              },
            },
          },
        },
        Quote: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                bridge: {
                  type: 'string',
                  enum: ['stargate', 'layerzero', 'cctp'],
                  example: 'stargate',
                },
                tool: {
                  type: 'string',
                  example: 'specific_bridge_name',
                },
                inputAmount: {
                  type: 'string',
                  example: '1000000000000000000',
                },
                expectedOutput: {
                  type: 'string',
                  example: '995000000000000000',
                },
                slippage: {
                  type: 'string',
                  example: '0.5',
                },
                estimatedGas: {
                  type: 'string',
                  example: '150000',
                },
                executionTime: {
                  type: 'string',
                  example: '2-5 minutes',
                },
              },
            },
          },
        },
        OrderId: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                orderId: {
                  type: 'string',
                  example: '0x1234567890abcdef1234567890abcdef12345678',
                },
                parameters: {
                  type: 'object',
                  properties: {
                    sourceChainId: {
                      type: 'number',
                      example: 1,
                    },
                    destinationChainId: {
                      type: 'number',
                      example: 100,
                    },
                    recipientAddress: {
                      type: 'string',
                      example: '0x7890abcdef1234567890abcdef1234567890abcd',
                    },
                    udAddress: {
                      type: 'string',
                      example: '0x1234567890abcdef1234567890abcdef12345678',
                    },
                    sourceToken: {
                      type: 'string',
                      example: '0xdef1234567890abcdef1234567890abcdef1234',
                    },
                    destinationToken: {
                      type: 'string',
                      example: '0xabcdef1234567890abcdef1234567890abcdef12',
                    },
                  },
                },
              },
            },
          },
        },
        SafeDeployed: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                isDeployed: {
                  type: 'boolean',
                  example: true,
                },
                contracts: {
                  type: 'object',
                  properties: {
                    udSafe: {
                      type: 'object',
                      properties: {
                        address: {
                          type: 'string',
                          example: '0x1234567890abcdef1234567890abcdef12345678',
                        },
                        hasCode: {
                          type: 'boolean',
                          example: true,
                        },
                      },
                    },
                    safeModuleLogic: {
                      type: 'object',
                      properties: {
                        address: {
                          type: 'string',
                          example: '0xabcdef1234567890abcdef1234567890abcdef12',
                        },
                        hasCode: {
                          type: 'boolean',
                          example: true,
                        },
                      },
                    },
                    safeModuleProxy: {
                      type: 'object',
                      properties: {
                        address: {
                          type: 'string',
                          example: '0x7890abcdef1234567890abcdef1234567890abcd',
                        },
                        hasCode: {
                          type: 'boolean',
                          example: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        SupportedChainsAssets: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                chains: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      chainId: {
                        type: 'number',
                        example: 1,
                      },
                      name: {
                        type: 'string',
                        example: 'Ethereum',
                      },
                      rpcUrl: {
                        type: 'string',
                        example: 'https://mainnet.infura.io/v3/your-api-key',
                      },
                      tokens: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            symbol: {
                              type: 'string',
                              example: 'USDC',
                            },
                            address: {
                              type: 'string',
                              example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                            },
                            decimals: {
                              type: 'number',
                              example: 6,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        RegisterAddress: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Address registered successfully',
            },
            data: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  example: '0x1234567890abcdef1234567890abcdef12345678',
                },
                udAddress: {
                  type: 'string',
                  example: '0xabcdef1234567890abcdef1234567890abcdef12',
                },
                registeredAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2025-06-07T12:00:00Z',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
}

const specs = swaggerJsdoc(options)

export function setupSwagger(app) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
    }),
  )

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(specs)
  })
}
