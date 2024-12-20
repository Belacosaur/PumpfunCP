import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        publicKey: body.publicKey,
        action: "create",
        tokenMetadata: body.tokenMetadata,
        mint: body.mint,
        denominatedInSol: "true",
        amount: 0,
        slippage: 10,
        priorityFee: 0.0005,
        pool: "pump",
        blockhash: body.blockhash,
        lastValidBlockHeight: body.lastValidBlockHeight
      })
    });

    if (!response.ok) {
      console.error('Failed to create token:', await response.text());
      throw new Error(`Token creation failed: ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('Error in create-token route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}