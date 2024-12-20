import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let managerKeypair: Keypair | null = null;

export function getManagerKeypair(): Keypair {
  if (!managerKeypair) {
    const privateKeyString = process.env.MANAGER_PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('MANAGER_PRIVATE_KEY environment variable is not set');
    }

    try {
      // Decode base58 private key
      const privateKeyBytes = bs58.decode(privateKeyString);
      managerKeypair = Keypair.fromSecretKey(privateKeyBytes);
      
      // Log public key for verification (but never log private key!)
      console.log(`Manager wallet public key: ${managerKeypair.publicKey.toString()}`);
    } catch (error) {
      console.error('Error creating manager keypair:', error);
      throw new Error('Invalid manager private key format - must be base58 encoded');
    }
  }

  return managerKeypair;
} 