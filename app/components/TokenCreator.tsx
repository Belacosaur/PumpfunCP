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
      // Get token creation data first
      const { transaction, mintKeypair, mintAddress: newMintAddress } = 
        await createPumpToken(connection, config, publicKey);
      
      mintAddress = newMintAddress;

      // Get fresh blockhash right before sending
      const { blockhash, lastValidBlockHeight } = 
        await connection.getLatestBlockhash('finalized');
      
      // Update transaction blockhash
      transaction.message.recentBlockhash = blockhash;

      // Decompile message to modify instructions
      const message = TransactionMessage.decompile(transaction.message);

      // Remove any existing compute budget instructions
      message.instructions = message.instructions.filter(
        inst => !inst.programId.equals(ComputeBudgetProgram.programId)
      );

      // Add compute budget instructions with higher values
      message.instructions.unshift(
        ComputeBudgetProgram.setComputeUnitLimit({ 
          units: 1_400_000
        }),
        ComputeBudgetProgram.setComputeUnitPrice({ 
          microLamports: 500_000  // Increased priority fee significantly
        })
      );

      // Recompile message
      transaction.message = message.compileToV0Message();

      // Sign and send immediately
      transaction.sign([mintKeypair]);
      const signedTx = await signTransaction(transaction);
      
      // Send with retries and preflight disabled
      signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`Token creation transaction sent: ${signature}`);

      // Wait for confirmation with shorter timeout
      await Promise.race([
        connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Creation confirmation timeout')), 30000)
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

      // Wait for purchase confirmation with longer timeout
      await Promise.race([
        connection.confirmTransaction({
          signature: purchaseSignature,
          blockhash: newBlockhash,
          lastValidBlockHeight
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Purchase confirmation timeout')), 120000)
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
    <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Create Pump.fun Token</h1>
        <WalletConnect />
      </div>

      <div className="mb-6 p-5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
        <h2 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">Fee Information</h2>
        <div className="space-y-2 text-blue-700 dark:text-blue-300">
          <p className="flex justify-between">
            <span>Creation Fee:</span>
            <span className="font-mono">{CREATION_FEE} SOL</span>
          </p>
          <p className="flex justify-between">
            <span>Manager Purchase:</span>
            <span className="font-mono">{TOKEN_PURCHASE_AMOUNT} SOL</span>
          </p>
        </div>
      </div>

      <TokenForm onSubmit={handleSubmit} isLoading={isLoading} />
      
      {result && (
        <div className="mt-6 p-5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm text-gray-700 dark:text-gray-300">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
} 