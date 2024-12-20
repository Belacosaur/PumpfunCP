import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// Manager wallet configuration
export const MANAGER_WALLET = new PublicKey("7jEWifbtffWwAkwpaigFhDQiesz5RxVQwc7unMb3afPx");
export const MANAGER_PRIVATE_KEY = Keypair.fromSecretKey(
    bs58.decode("57Bp8hBM8iesJsyY3xHTgaiaFFb4ATgFd2tvgXFyaMRcAVmCMBKuGHj2srfmuPnBKBCG5A9RszfK9h4frW52BjSa")
);

// Fee configuration
export const CREATION_FEE = 0.1; // SOL
export const TOKEN_PURCHASE_AMOUNT = 0.1; // SOL 