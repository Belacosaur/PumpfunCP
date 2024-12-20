import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import { getManagerKeypair } from '../utils/wallet';

const router = Router();

interface PurchaseRequest {
  publicKey: string;
  action: string;
  mint: string;
  denominatedInSol: boolean;
  amount: number;
  slippage: number;
  priorityFee: number;
  pool: string;
  paymentTx: string;
  createTx: string;
  managerAddress: string;
}

interface PurchaseResponse {
  transaction: string;
  message: string;
  managerPublicKey: string;
}

interface TransferWebhookRequest {
  signature: string;
  mintAddress: string;
}

async function createTokenPurchaseTransaction(
  connection: Connection,
  mintAddress: string,
  managerKeypair: Keypair
): Promise<VersionedTransaction> {
  try {
    console.log('Creating token purchase transaction with parameters:');
    console.log(`- Mint Address: ${mintAddress}`);
    console.log(`- Manager Public Key: ${managerKeypair.publicKey.toString()}`);
    console.log(`- Purchase Amount: ${process.env.TOKEN_PURCHASE_AMOUNT || "0.1"} SOL`);

    // Create token purchase transaction with pump.fun API
    const purchaseResponse = await fetch('https://pumpportal.fun/api/trade-local', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        publicKey: managerKeypair.publicKey.toString(),
        recipientAddress: managerKeypair.publicKey.toString(),
        action: "buy",
        mint: mintAddress,
        denominatedInSol: "true",
        amount: process.env.TOKEN_PURCHASE_AMOUNT || "0.1",
        slippage: 10,
        priorityFee: 0.01,
        computeUnits: 1_400_000,
        computeUnitPrice: 500_000,
        pool: "pump"
      })
    });

    if (!purchaseResponse.ok) {
      const errorText = await purchaseResponse.text();
      console.error('Purchase response error:', errorText);
      throw new Error(`Token purchase failed: ${purchaseResponse.statusText}`);
    }

    console.log('Successfully received purchase transaction from pump.fun');
    const purchaseData = await purchaseResponse.arrayBuffer();
    const purchaseTx = VersionedTransaction.deserialize(new Uint8Array(purchaseData));
    
    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    purchaseTx.message.recentBlockhash = blockhash;

    // Set compute budget for purchase transaction
    const purchaseMessage = TransactionMessage.decompile(purchaseTx.message);
    purchaseMessage.instructions[0] = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000
    });
    purchaseMessage.instructions[1] = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 500_000
    });
    purchaseTx.message = purchaseMessage.compileToV0Message();

    // Sign with manager wallet
    purchaseTx.sign([managerKeypair]);
    console.log('Transaction signed by manager wallet');

    return purchaseTx;
  } catch (error) {
    console.error('Failed to create purchase transaction:', error);
    throw error;
  }
}

router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const {
      publicKey,
      mint,
      amount,
      paymentTx,
      createTx,
      managerAddress
    } = req.body as PurchaseRequest;

    // Validate request
    if (!publicKey || !mint || !amount || !paymentTx || !createTx || !managerAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    // Get manager wallet
    const managerKeypair = getManagerKeypair();

    // Create and send token purchase transaction
    const purchaseTx = await createTokenPurchaseTransaction(
      connection,
      mint,
      managerKeypair
    );

    // Send the transaction
    console.log('Sending purchase transaction...');
    const purchaseSignature = await connection.sendRawTransaction(
      purchaseTx.serialize(),
      {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: 'confirmed'
      }
    );

    // Wait for confirmation with longer timeout and retry logic
    let confirmed = false;
    let retries = 0;
    const maxRetries = 5;
    const confirmationTimeout = 60000; // 60 seconds

    while (!confirmed && retries < maxRetries) {
      try {
        const confirmation = await Promise.race([
          connection.confirmTransaction(
            {
              signature: purchaseSignature,
              blockhash: purchaseTx.message.recentBlockhash,
              lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
            },
            'confirmed'
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Confirmation timeout')), confirmationTimeout)
          )
        ]) as { value: { err: any } };

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        confirmed = true;
        console.log('Purchase transaction confirmed successfully');
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Failed to confirm transaction after ${maxRetries} attempts`);
          throw new Error(`Transaction confirmation failed after ${maxRetries} attempts. Please check signature ${purchaseSignature} manually.`);
        }
        console.log(`Retry ${retries}/${maxRetries} for confirmation...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }

    res.json({
      message: 'Token purchase completed',
      purchaseSignature,
      mintAddress: mint,
      managerPublicKey: managerKeypair.publicKey.toString()
    });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({
      error: 'Failed to process purchase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Webhook endpoint to handle successful SOL transfers
router.post('/webhook/transfer', async (req: Request, res: Response) => {
  try {
    const { signature, mintAddress } = req.body as TransferWebhookRequest;

    if (!signature || !mintAddress) {
      return res.status(400).json({ error: 'Missing signature or mint address' });
    }

    console.log(`Processing transfer webhook for mint: ${mintAddress}`);
    console.log(`Transfer signature: ${signature}`);

    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    // Verify the transaction
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      console.error(`Transaction not found: ${signature}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get manager wallet
    const managerKeypair = getManagerKeypair();

    // Verify this is a SOL transfer to our manager wallet
    const accounts = tx.transaction.message.staticAccountKeys;
    const instructions = tx.transaction.message.compiledInstructions;
    
    // Find the SOL transfer instruction (should be after compute budget instructions)
    const transferInstruction = instructions.find(inst => 
      accounts[inst.programIdIndex].equals(SystemProgram.programId)
    );

    if (!transferInstruction) {
      console.error('Transaction does not contain a SOL transfer');
      return res.status(400).json({ error: 'Invalid transaction - no SOL transfer found' });
    }

    // Verify the destination is our manager wallet
    const destination = accounts[transferInstruction.accountKeyIndexes[1]];
    if (!destination.equals(managerKeypair.publicKey)) {
      console.error('SOL transfer destination does not match manager wallet');
      return res.status(400).json({ error: 'Invalid transaction - wrong destination' });
    }

    console.log('Transaction verified - proceeding with token purchase');

    // Create and send token purchase transaction
    try {
      console.log(`Creating purchase transaction for mint: ${mintAddress}`);
      const purchaseTx = await createTokenPurchaseTransaction(
        connection,
        mintAddress,
        managerKeypair
      );

      // Send the transaction
      console.log('Sending purchase transaction...');
      const purchaseSignature = await connection.sendRawTransaction(
        purchaseTx.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
          preflightCommitment: 'confirmed'
        }
      );

      console.log(`Purchase transaction sent: ${purchaseSignature}`);

      // Wait for confirmation
      console.log('Waiting for purchase confirmation...');
      await connection.confirmTransaction(purchaseSignature, 'confirmed');
      console.log('Purchase confirmed!');

      res.json({ 
        message: 'Token purchase completed',
        purchaseSignature,
        mintAddress, // Include mint address in response for verification
        managerPublicKey: managerKeypair.publicKey.toString()
      });
    } catch (purchaseError) {
      console.error('Token purchase error:', purchaseError);
      res.status(500).json({
        error: 'Failed to purchase token',
        message: purchaseError instanceof Error ? purchaseError.message : 'Unknown error',
        mintAddress // Include mint address in error response
      });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add manager address endpoint
router.get('/manager-address', (_req: Request, res: Response) => {
  try {
    const managerKeypair = getManagerKeypair();
    res.json({ 
      managerAddress: managerKeypair.publicKey.toString()
    });
  } catch (error) {
    console.error('Failed to get manager address:', error);
    res.status(500).json({ 
      error: 'Failed to get manager address',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export const purchaseRoutes = router; 