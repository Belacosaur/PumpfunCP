'use client';

import { 
  Connection, 
  Keypair, 
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { PumpConfig } from './types';

const JITO_TIPS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
];

export async function createPumpToken(connection: Connection, config: PumpConfig, wallet: PublicKey) {
  const mintKeypair = Keypair.generate();
  console.log(`Creating coin: ${mintKeypair.publicKey.toString()}... in pump.fun`);

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
      priorityFee: 0.005,
      pool: "pump"
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create token: ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  
  // Decompile message to modify instructions
  const message = TransactionMessage.decompile(tx.message);
  
  // Remove any existing compute budget instructions
  message.instructions = message.instructions.filter(
    inst => !inst.programId.equals(ComputeBudgetProgram.programId)
  );
  
  // Add compute budget instructions at the start
  message.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
  );

  // Add tip instruction at the end
  const tipInstruction = SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey: new PublicKey(JITO_TIPS[Math.floor(Math.random() * JITO_TIPS.length)]),
    lamports: 1_000_000,
  });
  message.instructions.push(tipInstruction);

  // Recompile message and create transaction
  tx.message = message.compileToV0Message();

  return {
    transaction: tx,
    mintKeypair,
    mintAddress: mintKeypair.publicKey.toString()
  };
} 