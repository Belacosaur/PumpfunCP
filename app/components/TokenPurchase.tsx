import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import InputField from './InputField';

interface TokenPurchaseProps {
  mintAddress: string;
}

export default function TokenPurchase({ mintAddress }: TokenPurchaseProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !signTransaction || !amount) return;

    setIsLoading(true);
    let purchaseSignature: string | undefined;

    try {
      const purchaseResponse = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          action: "buy",
          mint: mintAddress,
          denominatedInSol: "true",
          amount: parseFloat(amount),
          slippage: 10,
          priorityFee: 0.005,
          computeUnits: 1_400_000,
          computeUnitPrice: 500_000,
          pool: "pump"
        })
      });

      if (!purchaseResponse.ok) {
        const errorText = await purchaseResponse.text();
        throw new Error(`Purchase failed: ${errorText}`);
      }

      const purchaseData = await purchaseResponse.arrayBuffer();
      const purchaseTx = VersionedTransaction.deserialize(new Uint8Array(purchaseData));
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      purchaseTx.message.recentBlockhash = blockhash;

      // Set compute budget
      const purchaseMessage = TransactionMessage.decompile(purchaseTx.message);
      purchaseMessage.instructions[0] = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_400_000
      });
      purchaseMessage.instructions[1] = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 500_000
      });
      purchaseTx.message = purchaseMessage.compileToV0Message();

      // Sign with user wallet
      const signedTx = await signTransaction(purchaseTx);

      // Send purchase transaction
      purchaseSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      await connection.confirmTransaction({
        signature: purchaseSignature,
        blockhash,
        lastValidBlockHeight
      });

      setResult(`Purchase successful! TX: https://solscan.io/tx/${purchaseSignature}`);
    } catch (error) {
      console.error('Purchase error:', error);
      setResult(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-6 p-5 border rounded-lg bg-gray-50 dark:bg-gray-800/30">
      <h2 className="text-lg font-semibold mb-4">Purchase Tokens</h2>
      <form onSubmit={handlePurchase} className="space-y-4">
        <InputField
          label="Amount (SOL)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          type="number"
          step="0.01"
          min="0.01"
        />
        <button
          type="submit"
          disabled={isLoading || !amount}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-lg
                   hover:bg-green-700 focus:ring-4 focus:ring-green-300
                   disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Purchasing...' : 'Purchase Tokens'}
        </button>
      </form>
      {result && (
        <div className="mt-4 p-3 rounded bg-gray-100 dark:bg-gray-700">
          <pre className="whitespace-pre-wrap break-words text-sm">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
} 