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
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { CREATION_FEE, TOKEN_PURCHASE_AMOUNT, BACKEND_URL } from '../lib/config';
import TokenPurchase from './TokenPurchase';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function TokenCreator() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [createdMintAddress, setCreatedMintAddress] = useState<string>('');

  const handleSubmit = async (config: PumpConfig) => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    let paymentSignature: string | undefined;
    let createSignature: string | undefined;
    let mintAddress: string | undefined;
    
    try {
      // Get transaction data
      const { paymentTransaction, createTransaction, mintKeypair, mintAddress: newMintAddress } = 
        await createPumpToken(connection, config, publicKey);
      
      mintAddress = newMintAddress;

      // Step 1: Send payment transaction
      console.log('Sending payment transaction...');
      const signedPaymentTx = await signTransaction(paymentTransaction);
      paymentSignature = await connection.sendRawTransaction(signedPaymentTx.serialize(), {
        skipPreflight: false,
        maxRetries: 1,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`Payment transaction sent: ${paymentSignature}`);

      // Wait for IMMEDIATE payment confirmation - fail fast if not confirmed quickly
      const startTime = Date.now();
      let confirmed = false;

      while (Date.now() - startTime < 5000) {
        const status = await connection.getSignatureStatus(paymentSignature);
        
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          console.log(`Payment confirmed with status: ${status.value.confirmationStatus}`);
          break;
        }

        if (status.value?.err) {
          throw new Error(`Payment failed: ${JSON.stringify(status.value.err)}`);
        }

        // Quick poll interval
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!confirmed) {
        throw new Error('Payment failed to confirm quickly - please try again');
      }

      // Proceed with token creation
      console.log('Payment processed, creating token...');

      // Step 2: Send token creation transaction
      createTransaction.sign([mintKeypair]);
      const signedCreateTx = await signTransaction(createTransaction);
      createSignature = await connection.sendRawTransaction(signedCreateTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`Token creation transaction sent: ${createSignature}`);

      // Monitor token creation status
      let confirmationAttempts = 0;
      const maxAttempts = 30;
      
      while (confirmationAttempts < maxAttempts) {
        const status = await connection.getSignatureStatus(createSignature);
        
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          console.log(`Token creation confirmed with status: ${status.value.confirmationStatus}`);
          break;
        }
        
        if (status.value?.err) {
          throw new Error(`Token creation failed: ${JSON.stringify(status.value.err)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        confirmationAttempts++;
        
        if (confirmationAttempts === maxAttempts) {
          throw new Error('Token creation timeout - please check Solscan for status');
        }
      }

      // Notify backend to purchase tokens
      console.log('Token created, notifying backend to purchase...');
      
      // First try to get manager address with better error handling
      let managerAddress;
      try {
        const managerResponse = await fetch(`${BACKEND_URL}/api/manager-address`);
        if (!managerResponse.ok) {
          throw new Error(`Failed to fetch manager address: ${managerResponse.statusText}`);
        }
        const managerData = await managerResponse.json();
        managerAddress = managerData.managerAddress;
      } catch (error) {
        console.error('Failed to fetch manager address:', error);
        throw new Error('Unable to connect to backend service. This could be due to CORS restrictions. Please try again later or contact support.');
      }

      const purchaseResponse = await fetch(`${BACKEND_URL}/api/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          action: "buy",
          mint: mintAddress,
          denominatedInSol: true,
          amount: TOKEN_PURCHASE_AMOUNT,
          slippage: 10,
          priorityFee: 0.001,
          pool: "pump",
          paymentTx: paymentSignature,
          createTx: createSignature,
          managerAddress
        })
      });

      const purchaseResponseData = await purchaseResponse.json();
      console.log('Backend purchase response:', purchaseResponseData);

      if (!purchaseResponse.ok) {
        const errorText = JSON.stringify(purchaseResponseData);
        console.error('Backend response:', errorText);
        throw new Error(`Failed to initiate token purchase on backend: ${errorText}`);
      }

      setCreatedMintAddress(mintAddress);

      setResult(
        `Token created successfully!\n` +
        `Mint address: ${mintAddress}\n` +
        `Payment: https://solscan.io/tx/${paymentSignature}\n` +
        `Creation: https://solscan.io/tx/${createSignature}\n` +
        `Purchase: https://solscan.io/tx/${purchaseResponseData.purchaseSignature}\n` +
        `Backend purchase completed.`
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

      {createdMintAddress && (
        <TokenPurchase mintAddress={createdMintAddress} />
      )}
    </div>
  );
} 