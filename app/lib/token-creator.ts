'use client';

import { 
  Connection, 
  Keypair, 
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { PumpConfig } from './types';
import { TOKEN_PURCHASE_AMOUNT, CREATION_FEE, BACKEND_URL } from './config';

export async function createPumpToken(connection: Connection, config: PumpConfig, wallet: PublicKey) {
  const mintKeypair = Keypair.generate();
  console.log(`Preparing to create coin: ${mintKeypair.publicKey.toString()}...`);

  // First, create and send the payment transaction
  console.log('Creating payment transaction...');
  
  // Get manager wallet address for SOL transfer
  console.log('Fetching manager address from:', `${BACKEND_URL}/api/manager-address`);
  const managerResponse = await fetch(`${BACKEND_URL}/api/manager-address`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!managerResponse.ok) {
    const errorText = await managerResponse.text();
    console.error('Manager address error:', errorText);
    throw new Error('Failed to get manager wallet address');
  }
  const { managerAddress } = await managerResponse.json();

  const paymentTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        // Add compute budget instructions with higher priority fee
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
        // Add SOL transfer to manager wallet
        SystemProgram.transfer({
          fromPubkey: wallet,
          toPubkey: new PublicKey(managerAddress),
          lamports: (TOKEN_PURCHASE_AMOUNT + CREATION_FEE) * LAMPORTS_PER_SOL
        })
      ]
    }).compileToV0Message()
  );

  // After payment is confirmed, proceed with token creation
  const formData = new FormData();
  formData.append("file", config.file);
  formData.append("name", config.name);
  formData.append("symbol", config.symbol);
  formData.append("description", config.description);
  formData.append("twitter", config.twitter);
  formData.append("telegram", config.telegram);
  formData.append("website", config.website);
  formData.append("showName", "true");

  console.log('Uploading metadata to IPFS...');
  const metadataResponse = await fetch("/api/ipfs", {
    method: "POST",
    body: formData,
  });

  if (!metadataResponse.ok) {
    throw new Error('Failed to upload metadata');
  }

  const metadataResponseJSON = await metadataResponse.json();
  console.log('Metadata uploaded successfully');

  const response = await fetch("/api/create-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      publicKey: wallet.toString(),
      action: "create",
      tokenMetadata: {
        name: metadataResponseJSON.metadata.name,
        symbol: metadataResponseJSON.metadata.symbol,
        uri: metadataResponseJSON.metadataUri
      },
      mint: mintKeypair.publicKey.toString(),
      denominatedInSol: "true",
      amount: 0,
      slippage: 10,
      priorityFee: 0.001,
      pool: "pump"
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create token: ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  const createTx = VersionedTransaction.deserialize(new Uint8Array(data));

  return {
    paymentTransaction: paymentTx,
    createTransaction: createTx,
    mintKeypair,
    mintAddress: mintKeypair.publicKey.toString()
  };
} 