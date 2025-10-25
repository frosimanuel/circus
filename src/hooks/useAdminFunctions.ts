import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Keypair, SystemProgram, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useRaffleProgram } from './useRaffleProgram';
import { getProtocolStatePDA, getRoundStatePDA, getUserAccountPDA, PROGRAM_ID } from '../config/solana';

/**
 * Admin functions hook
 *
 * Provides functions for initializing protocol and managing rounds
 * Only callable by the admin wallet
 */
export const useAdminFunctions = () => {
  const { publicKey } = useWallet();
  const { program, isReady } = useRaffleProgram();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const initializeProtocol = useCallback(async () => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();

      // Use a dummy validator address for now
      const validator = Keypair.generate().publicKey;

      const tx = await program.methods
        .initialize(validator)
        .accountsPartial({
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      console.log('Protocol initialized:', tx);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Initialize protocol error:', err);
      const errorMsg = err.message || 'Failed to initialize protocol';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  const seedPrize = useCallback(async (amountSOL: number) => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();
      const amountLamports = new BN(amountSOL * 1e9);

      const tx = await program.methods
        .seedPrize(amountLamports)
        .accountsPartial({
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      console.log('Prize seeded:', tx);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Seed prize error:', err);
      const errorMsg = err.message || 'Failed to seed prize';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  const initializeRound = useCallback(async (roundId: number) => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();
      const [roundPda] = getRoundStatePDA(protocolPda, roundId);

      const stakeAccount = Keypair.generate();
      const randomSeed = Date.now();

      const tx = await program.methods
        .initRound(new BN(roundId), new BN(randomSeed))
        .accountsPartial({
          admin: publicKey,
          stakeAccount: stakeAccount.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      console.log('Round initialized:', tx);

      return { success: true, signature: tx, roundPda: roundPda.toBase58() };
    } catch (err: any) {
      console.error('Initialize round error:', err);
      const errorMsg = err.message || 'Failed to initialize round';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  const advanceEpoch = useCallback(async () => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();

      // Get current round ID
      const protocolState = await program.account.protocolState.fetch(protocolPda);
      const currentRound = protocolState.currentRound.toNumber();

      const [roundPda] = getRoundStatePDA(protocolPda, currentRound);

      const tx = await program.methods
        .advanceEpoch()
        .accountsPartial({
          admin: publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .rpc();

      setLastTx(tx);
      console.log('Epoch advanced:', tx);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Advance epoch error:', err);
      const errorMsg = err.message || 'Failed to advance epoch';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  const takeSnapshot = useCallback(async () => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();

      // Get current round ID
      const protocolState = await program.account.protocolState.fetch(protocolPda);
      const currentRound = protocolState.currentRound.toNumber();

      const [roundPda] = getRoundStatePDA(protocolPda, currentRound);

      // Get all user accounts that participated in this round
      const allAccounts = await program.account.userAccount.all();

      // Filter for users who joined this round
      const participatingAccounts = allAccounts
        .filter((acc) => acc.account.roundJoined.toNumber() === currentRound)
        .map((acc) => acc.publicKey);

      console.log('Taking snapshot for', participatingAccounts.length, 'participants');

      const tx = await program.methods
        .takeSnapshotBatch()
        .accountsPartial({
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .remainingAccounts(
          participatingAccounts.map((pk) => ({
            pubkey: pk,
            isWritable: true,
            isSigner: false,
          }))
        )
        .rpc();

      setLastTx(tx);
      console.log('Snapshot taken:', tx);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Take snapshot error:', err);
      const errorMsg = err.message || 'Failed to take snapshot';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  const selectWinner = useCallback(async () => {
    if (!program || !publicKey) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();

      // Get current round ID
      const protocolState = await program.account.protocolState.fetch(protocolPda);
      const currentRound = protocolState.currentRound.toNumber();

      const [roundPda] = getRoundStatePDA(protocolPda, currentRound);

      // Get all user accounts that participated in this round
      const allAccounts = await program.account.userAccount.all();

      // Filter for users who joined this round
      const participatingAccounts = allAccounts
        .filter((acc) => acc.account.roundJoined.toNumber() === currentRound)
        .map((acc) => acc.publicKey);

      console.log('Found', participatingAccounts.length, 'participants');

      // Generate random seed
      const seed = new BN(Date.now());

      const tx = await program.methods
        .selectWinnerLocal(seed)
        .accountsPartial({
          admin: publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .remainingAccounts(
          participatingAccounts.map((pk) => ({
            pubkey: pk,
            isWritable: true,
            isSigner: false,
          }))
        )
        .rpc();

      setLastTx(tx);
      console.log('Winner selected:', tx);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Select winner error:', err);
      const errorMsg = err.message || 'Failed to select winner';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  }, [program, publicKey]);

  return {
    initializeProtocol,
    seedPrize,
    initializeRound,
    advanceEpoch,
    takeSnapshot,
    selectWinner,
    isProcessing,
    error,
    lastTx,
    isReady,
  };
};
