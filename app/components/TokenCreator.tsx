'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PumpConfig } from '../lib/types';
import { createPumpToken } from '../lib/token-creator';
import TokenForm from './TokenForm';
import WalletConnect from './WalletConnect';
import { 
  TransactionMessage, 
  VersionedTransaction, 
  ComputeBudgetProgram,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { MANAGER_WALLET, MANAGER_PRIVATE_KEY, CREATION_FEE, TOKEN_PURCHASE_AMOUNT } from '../lib/config';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function TokenCreator() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSubmit = async (config: PumpConfig) => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    let signature: string | undefined;
    let mintAddress: string | undefined;
    let purchaseSignature: string | undefined;
    
    try {
      // Get latest blockhash right before transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      
      const { transaction, mintKeypair, mintAddress: newMintAddress } = 
        await createPumpToken(connection, config, publicKey);
      
      mintAddress = newMintAddress;

      // Update transaction blockhash
      transaction.message.recentBlockhash = blockhash;

      // Sign and send immediately
      transaction.sign([mintKeypair]);
      const signedTx = await signTransaction(transaction);
      
      // Send with retries and preflight
      signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
        preflightCommitment: 'processed'
      });
      
      console.log(`Token creation transaction sent: ${signature}`);

      // Wait for confirmation with shorter timeout
      await Promise.race([
        connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'processed'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Confirmation timeout')), 30000)
        )
      ]);

      // Reduced wait time before purchase
      await sleep(1000);

      // Create token purchase transaction with updated settings
      const purchaseResponse = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          publicKey: MANAGER_WALLET.toString(),
          recipientAddress: publicKey.toString(),
          action: "buy",
          mint: mintAddress,
          denominatedInSol: "true",
          amount: TOKEN_PURCHASE_AMOUNT,
          slippage: 10,
          priorityFee: 0.005,
          computeUnits: 1_400_000,
          computeUnitPrice: 100_000,
          pool: "pump"
        })
      });

      if (!purchaseResponse.ok) {
        const errorText = await purchaseResponse.text();
        console.error('Purchase response error:', errorText);
        throw new Error(`Token purchase failed: ${purchaseResponse.statusText}`);
      }

      const purchaseData = await purchaseResponse.arrayBuffer();
      const purchaseTx = VersionedTransaction.deserialize(new Uint8Array(purchaseData));
      
      // Get fresh blockhash
      const { blockhash: newBlockhash } = await connection.getLatestBlockhash('confirmed');
      purchaseTx.message.recentBlockhash = newBlockhash;

      // Set compute budget for purchase transaction
      const purchaseMessage = TransactionMessage.decompile(purchaseTx.message);
      purchaseMessage.instructions[0] = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_400_000
      });
      purchaseMessage.instructions[1] = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000
      });
      purchaseTx.message = purchaseMessage.compileToV0Message();

      // Sign with manager wallet
      purchaseTx.sign([MANAGER_PRIVATE_KEY]);

      // Send purchase transaction
      purchaseSignature = await connection.sendRawTransaction(purchaseTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log(`Token purchase transaction sent: ${purchaseSignature}`);

      // Wait for purchase confirmation
      await Promise.race([
        connection.confirmTransaction({
          signature: purchaseSignature,
          blockhash: newBlockhash,
          lastValidBlockHeight
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Purchase confirmation timeout')), 90000)
        )
      ]);

      setResult(
        `Token created and purchased successfully!\n` +
        `Mint address: ${mintAddress}\n` +
        `Creation TX: https://solscan.io/tx/${signature}\n` +
        (purchaseSignature ? `Purchase TX: https://solscan.io/tx/${purchaseSignature}` : '')
      );
    } catch (error) {
      console.error('Transaction error:', error);
      setResult(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Create Pump.fun Token</h1>
        <WalletConnect />
      </div>

      <div className="mb-4 p-4 rounded bg-blue-100 dark:bg-blue-900">
        <p>Creation Fee: {CREATION_FEE} SOL</p>
        <p>Manager Purchase: {TOKEN_PURCHASE_AMOUNT} SOL worth of tokens</p>
      </div>

      <TokenForm onSubmit={handleSubmit} isLoading={isLoading} />
      
      {result && (
        <div className="mt-4 p-4 rounded bg-gray-100 dark:bg-gray-800">
          <pre className="whitespace-pre-wrap break-words">{result}</pre>
        </div>
      )}
    </div>
  );
} 