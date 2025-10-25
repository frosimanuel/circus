import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useRaffleProgram } from './useRaffleProgram';
import { getProtocolStatePDA, getUserAccountPDA } from '../config/solana';
import { isValidTicketAmount, solToTickets, TICKET_PRICE_SOL } from '../utils/tickets';

/**
 * Custom hook for raffle transactions
 *
 * Provides functions to deposit SOL (buy tickets) and request withdrawals
 */
export const useRaffleTransactions = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program, isReady } = useRaffleProgram();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  /**
   * Deposit SOL to buy tickets
   * @param amountSOL Amount in SOL to deposit (must be multiple of 0.01)
   */
  const deposit = useCallback(async (amountSOL: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady || !publicKey) {
      const errorMsg = 'Wallet not connected or program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (amountSOL <= 0) {
      const errorMsg = 'Amount must be greater than 0';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Validate ticket amount (must be exact multiple of 0.01 SOL)
    if (!isValidTicketAmount(amountSOL)) {
      const errorMsg = `Amount must be whole tickets only! Each ticket costs ${TICKET_PRICE_SOL} SOL. Try ${Math.floor(solToTickets(amountSOL)) * TICKET_PRICE_SOL} SOL instead.`;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const numTickets = solToTickets(amountSOL);
    console.log(`Buying ${numTickets} ticket(s) for ${amountSOL} SOL`);

    setIsProcessing(true);
    setError(null);

    try {
      // Convert SOL to lamports
      const amountLamports = new BN(amountSOL * LAMPORTS_PER_SOL);

      // Get PDAs
      const [protocolPda] = getProtocolStatePDA();
      const [userPda] = getUserAccountPDA(publicKey);

      // Fetch protocol state to get current round
      const protocolState = await program.account.protocolState.fetch(protocolPda);
      const currentRoundId = protocolState.currentRound;

      // Get round PDA
      const { getRoundStatePDA } = await import('../config/solana');
      const [roundPda] = getRoundStatePDA(protocolPda, currentRoundId);

      console.log('Depositing:', {
        amount: amountSOL,
        tickets: numTickets,
        lamports: amountLamports.toString(),
        userPda: userPda.toString(),
        protocolPda: protocolPda.toString(),
        roundPda: roundPda.toString(),
      });

      // Call deposit instruction with round account in remaining_accounts
      const tx = await program.methods
        .deposit(amountLamports)
        .accounts({
          user: publicKey,
          protocolState: protocolPda,
          userAccount: userPda,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: roundPda, isSigner: false, isWritable: true }
        ])
        .rpc();

      console.log('Deposit transaction signature:', tx);

      // Wait for confirmation
      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Deposit failed:', err);

      let errorMessage = 'Transaction failed';

      // Check for specific ticket amount error
      if (err.message && err.message.includes('InvalidTicketAmount')) {
        errorMessage = `Invalid ticket amount! You must buy whole tickets only. Each ticket costs exactly ${TICKET_PRICE_SOL} SOL.`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      if (err.logs) {
        console.error('Transaction logs:', err.logs);
        // Parse logs for better error messages
        const logs = err.logs.join(' ');
        if (logs.includes('InvalidTicketAmount')) {
          errorMessage = `Invalid ticket amount! Each ticket costs ${TICKET_PRICE_SOL} SOL. Only whole tickets allowed.`;
        }
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, publicKey, connection]);

  /**
   * Request withdrawal (forfeit tickets, get stake back)
   * @param amountSOL Amount in SOL to withdraw
   */
  const requestWithdrawal = useCallback(async (amountSOL: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady || !publicKey) {
      const errorMsg = 'Wallet not connected or program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (amountSOL <= 0) {
      const errorMsg = 'Amount must be greater than 0';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const amountLamports = new BN(amountSOL * LAMPORTS_PER_SOL);

      const [protocolPda] = getProtocolStatePDA();
      const [userPda] = getUserAccountPDA(publicKey);

      console.log('Requesting withdrawal:', {
        amount: amountSOL,
        lamports: amountLamports.toString(),
      });

      const tx = await program.methods
        .requestWithdrawal(amountLamports)
        .accounts({
          user: publicKey,
          protocolState: protocolPda,
          userAccount: userPda,
        })
        .rpc();

      console.log('Withdrawal request signature:', tx);

      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Withdrawal failed:', err);

      let errorMessage = 'Withdrawal request failed';
      if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, publicKey, connection]);

  /**
   * Create claim ticket (Step 1 of claiming)
   * Winner must call this before claiming their prize
   * @param roundId The round ID to create claim ticket for
   */
  const createClaimTicket = useCallback(async (roundId?: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady || !publicKey) {
      const errorMsg = 'Wallet not connected or program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Get PDAs
      const [protocolPda] = getProtocolStatePDA();
      const [userPda] = getUserAccountPDA(publicKey);

      // Use provided roundId or fetch user's current round
      let targetRoundId: number;
      if (roundId !== undefined) {
        targetRoundId = roundId;
      } else {
        // Fetch user account to get the round they joined
        const userAccount = await program.account.userAccount.fetch(userPda);
        targetRoundId = userAccount.roundJoined.toNumber();
      }

      // Get round PDA and ClaimTicket PDA
      const { getRoundStatePDA, getClaimTicketPDA } = await import('../config/solana');
      const [roundPda] = getRoundStatePDA(protocolPda, new BN(targetRoundId));
      const [claimTicketPda] = getClaimTicketPDA(targetRoundId, publicKey);

      console.log('Creating claim ticket for round:', {
        roundId: targetRoundId,
        userPda: userPda.toString(),
        protocolPda: protocolPda.toString(),
        roundPda: roundPda.toString(),
        claimTicketPda: claimTicketPda.toString(),
      });

      const tx = await program.methods
        .createClaimTicketWinner(new BN(targetRoundId))
        .accounts({
          winner: publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
          userAccount: userPda,
          claimTicket: claimTicketPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Create claim ticket transaction signature:', tx);
      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Create claim ticket failed:', err);

      let errorMessage = 'Create claim ticket failed';
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.logs) {
        console.error('Transaction logs:', err.logs);
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, publicKey, connection]);

  /**
   * Claim prize for winner after round completes (Step 2 of claiming)
   * Must call createClaimTicket first
   * @param roundId The round ID to claim from (allows claiming from any completed round)
   */
  const claimPrize = useCallback(async (roundId?: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady || !publicKey) {
      const errorMsg = 'Wallet not connected or program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Get PDAs
      const [protocolPda] = getProtocolStatePDA();
      const [userPda] = getUserAccountPDA(publicKey);

      // Use provided roundId or fetch current round
      let targetRoundId: number;
      if (roundId !== undefined) {
        targetRoundId = roundId;
      } else {
        // Fetch user account to get the round they joined
        const userAccount = await program.account.userAccount.fetch(userPda);
        targetRoundId = userAccount.roundJoined.toNumber();
      }

      // Get round PDA and ClaimTicket PDA
      const { getRoundStatePDA, getClaimTicketPDA } = await import('../config/solana');
      const [roundPda] = getRoundStatePDA(protocolPda, new BN(targetRoundId));
      const [claimTicketPda] = getClaimTicketPDA(targetRoundId, publicKey);

      console.log('Claiming prize for round:', {
        roundId: targetRoundId,
        userPda: userPda.toString(),
        protocolPda: protocolPda.toString(),
        roundPda: roundPda.toString(),
        claimTicketPda: claimTicketPda.toString(),
      });

      const tx = await program.methods
        .claimPrize(new BN(targetRoundId))
        .accounts({
          user: publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
          claimTicket: claimTicketPda,
          userAccount: userPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Claim prize transaction signature:', tx);
      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Claim prize failed:', err);

      let errorMessage = 'Claim prize failed';
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.logs) {
        console.error('Transaction logs:', err.logs);
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, publicKey, connection]);

  /**
   * Process withdrawal for non-winners after round completes
   * @param roundId The round ID to withdraw from (allows withdrawing from any completed round)
   */
  const processWithdrawal = useCallback(async (roundId?: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady || !publicKey) {
      const errorMsg = 'Wallet not connected or program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Get PDAs
      const [protocolPda] = getProtocolStatePDA();
      const [userPda] = getUserAccountPDA(publicKey);

      // Use provided roundId or fetch user's current round
      let targetRoundId: number;
      if (roundId !== undefined) {
        targetRoundId = roundId;
      } else {
        // Fetch user account to get the round they joined
        const userAccount = await program.account.userAccount.fetch(userPda);
        targetRoundId = userAccount.roundJoined.toNumber();
      }

      // Get round PDA
      const { getRoundStatePDA } = await import('../config/solana');
      const [roundPda] = getRoundStatePDA(protocolPda, new BN(targetRoundId));

      console.log('Processing withdrawal for round:', {
        roundId: targetRoundId,
        userPda: userPda.toString(),
        protocolPda: protocolPda.toString(),
        roundPda: roundPda.toString(),
      });

      const tx = await program.methods
        .processWithdrawal(new BN(targetRoundId))
        .accounts({
          user: publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
          userAccount: userPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Process withdrawal transaction signature:', tx);
      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Process withdrawal failed:', err);

      let errorMessage = 'Withdrawal processing failed';
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.logs) {
        console.error('Transaction logs:', err.logs);
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, publicKey, connection]);

  /**
   * Call crank to advance epoch or finalize round based on time
   * Can be called by anyone - permissionless
   */
  const callCrank = useCallback(async (): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!program || !isReady) {
      const errorMsg = 'Program not ready';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [protocolPda] = getProtocolStatePDA();

      // Get current round ID
      const protocolState = await program.account.protocolState.fetch(protocolPda);
      const currentRoundId = protocolState.currentRound;

      // Get round PDA
      const { getRoundStatePDA } = await import('../config/solana');
      const [roundPda] = getRoundStatePDA(protocolPda, currentRoundId);

      // Get all user accounts for winner selection
      const allAccounts = await program.account.userAccount.all();
      const participatingAccounts = allAccounts
        .filter((acc) => acc.account.roundJoined.toNumber() === currentRoundId.toNumber())
        .map((acc) => acc.publicKey);

      console.log('Calling crank for', participatingAccounts.length, 'participants');

      const tx = await program.methods
        .crank()
        .accounts({
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .remainingAccounts(
          participatingAccounts.map((pk) => ({
            pubkey: pk,
            isWritable: false,
            isSigner: false,
          }))
        )
        .rpc();

      console.log('Crank transaction signature:', tx);
      await connection.confirmTransaction(tx, 'confirmed');

      setLastTxSignature(tx);
      setIsProcessing(false);

      return { success: true, signature: tx };
    } catch (err: any) {
      console.error('Crank failed:', err);

      let errorMessage = 'Crank call failed';
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.logs) {
        console.error('Transaction logs:', err.logs);
      }

      setError(errorMessage);
      setIsProcessing(false);

      return { success: false, error: errorMessage };
    }
  }, [program, isReady, connection]);

  return {
    deposit,
    requestWithdrawal,
    createClaimTicket,
    claimPrize,
    processWithdrawal,
    callCrank,
    isProcessing,
    error,
    lastTxSignature,
  };
};
