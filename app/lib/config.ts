import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

if (!process.env.NEXT_PUBLIC_MANAGER_PRIVATE_KEY || !process.env.NEXT_PUBLIC_MANAGER_WALLET_ADDRESS) {
  throw new Error('Missing required environment variables');
}

// Manager wallet configuration
export const MANAGER_WALLET = new PublicKey(process.env.NEXT_PUBLIC_MANAGER_WALLET_ADDRESS);
export const MANAGER_PRIVATE_KEY = Keypair.fromSecretKey(
  bs58.decode(process.env.NEXT_PUBLIC_MANAGER_PRIVATE_KEY)
);

// Fee configuration
export const CREATION_FEE = 0.1; // SOL
export const TOKEN_PURCHASE_AMOUNT = 0.1; // SOL