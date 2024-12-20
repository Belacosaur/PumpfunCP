import { Keypair } from '@solana/web3.js';

export interface PumpConfig {
  file: File;
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
}

export interface TokenCreationResponse {
  success: boolean;
  message: string;
  txSignature?: string;
} 