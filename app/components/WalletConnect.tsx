'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletConnect() {
  const { publicKey } = useWallet();

  return (
    <div className="flex items-center space-x-4">
      <WalletMultiButton />
      {publicKey && (
        <span className="text-sm opacity-75">
          Connected: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </span>
      )}
    </div>
  );
} 