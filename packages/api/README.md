# Universal Deposits API

The Universal Deposits API provides endpoints for interacting with the Universal Deposits protocol, managing cross-chain deposits, and obtaining quotes for bridge transfers.

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/universal-deposits
REDIS_URL=redis://localhost:6379
```

## API Endpoints

### Core Endpoints

| Method | Endpoint                                 | Description                               |
| ------ | ---------------------------------------- | ----------------------------------------- |
| GET    | `/api/ud-safe-address`                   | Get Universal Deposit Safe address        |
| GET    | `/api/order/orderId/:orderId`            | Get order by ID                           |
| GET    | `/api/order/recipient/:recipientAddress` | Get order by recipient address            |
| GET    | `/api/order`                             | Get order by parameters                   |
| GET    | `/api/quote`                             | Get bridge quote for cross-chain transfer |
| GET    | `/api/order-id`                          | Generate deterministic order ID hash      |
| GET    | `/api/safe-deployed`                     | Check if Safe contracts are deployed      |
| POST   | `/api/register-address`                  | Register user address                     |
| GET    | `/api/health`                            | Health check endpoint                     |

### API Documentation

The API is documented using OpenAPI/Swagger. Once the server is running, you can access the documentation at:

```
http://localhost:3000/api-docs
```

This interactive documentation provides:

- Detailed request/response examples
- Parameter descriptions and validation rules
- Testing interface to make API calls directly from the browser
- Schema definitions and models
- Authentication requirements
