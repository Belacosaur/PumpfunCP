# PumpFun Backend Service

Backend service for PumpFun token creation and initial purchases on Solana.

## Features

- Token creation endpoint
- Automatic token purchases
- Manager wallet integration
- Secure transaction handling
- Rate limiting
- CORS support

## Prerequisites

- Node.js >= 18.0.0
- npm
- A Solana wallet for the manager account

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com

# Solana Configuration
SOLANA_RPC_URL=your_rpc_url
MANAGER_PRIVATE_KEY=your_base58_encoded_private_key
TOKEN_PURCHASE_AMOUNT=0.1

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

## Railway Deployment

1. Create a new project on [Railway](https://railway.app)

2. Connect your GitHub repository

3. Add the following environment variables in Railway:
   - `PORT`
   - `NODE_ENV`
   - `FRONTEND_URL`
   - `SOLANA_RPC_URL`
   - `MANAGER_PRIVATE_KEY`
   - `TOKEN_PURCHASE_AMOUNT`
   - `RATE_LIMIT_WINDOW_MS`
   - `RATE_LIMIT_MAX_REQUESTS`

4. Deploy:
   - Railway will automatically detect the Procfile and run the build
   - The `postinstall` script will handle TypeScript compilation
   - The service will start using `npm start`

## API Endpoints

### POST /api/purchase
Creates and executes a token purchase transaction.

### GET /api/manager-address
Returns the public key of the manager wallet.

## Security Considerations

- Never commit your `.env` file
- Keep your manager private key secure
- Use a dedicated RPC node for production
- Monitor rate limits and adjust as needed
- Regularly update dependencies

## License

MIT