import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Polyfill Buffer for Solana Web3.js
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
(window as any).Buffer = Buffer;

// Solana wallet adapter imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getRpcEndpoint } from './config/solana';

// Wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Application Entry Point with Wallet Integration
 *
 * Wraps app with Solana wallet providers for blockchain connectivity
 */
function Root() {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
