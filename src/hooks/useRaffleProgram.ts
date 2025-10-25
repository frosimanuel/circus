import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PROGRAM_ID } from '../config/solana';
import idlData from '../idl/rafa.json';

/**
 * Custom hook to get the Anchor program instance
 *
 * This hook provides access to the smart contract program
 * for making transactions and reading state
 */
export const useRaffleProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!wallet || !wallet.publicKey) {
      return null;
    }

    try {
      // Create anchor provider
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      // Create program instance with properly typed IDL
      return new Program(
        idlData as any,
        provider
      );
    } catch (error) {
      console.error('Error creating program:', error);
      return null;
    }
  }, [connection, wallet, wallet.publicKey]);

  return {
    program,
    provider: program?.provider as AnchorProvider | null,
    isReady: !!program && !!wallet.publicKey,
  };
};
