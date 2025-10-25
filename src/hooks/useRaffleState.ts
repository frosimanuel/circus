import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRaffleProgram } from './useRaffleProgram';
import { getProtocolStatePDA, getUserAccountPDA, getRoundStatePDA, getClaimTicketPDA } from '../config/solana';

/**
 * Types matching the Rust contract structs
 */
export interface ProtocolState {
  admin: string;
  validator: string;
  currentRound: number;
  prizeSeedAmount: number;
  totalUnclaimedPrizes: number;  // NEW: Track unclaimed prizes
  bump: number;
}

export interface RoundState {
  roundId: number;
  epochInRound: number;
  startEpoch: number;
  endEpoch: number;  // NEW: When round completed
  stakeAccount: string;
  totalStakedLamports: number;  // NEW: Total deposited
  totalPrizeLamports: number;
  totalTicketsSold: number;
  winner: string | null;
  winningTicket: number;
  isComplete: boolean;
  prizeClaimed: boolean;  // NEW: Track if winner claimed
  vrfRequest: string | null;
  bump: number;
}

export interface UserAccount {
  owner: string;
  balance: number;
  ticketStart: number;
  ticketEnd: number;
  snapshotBalances: number[];
  snapshotsRecordedMask: number;
  roundJoined: number;
  pendingWithdrawalAmount: number;
  pendingWithdrawalRound: number;
  bump: number;
}

export interface ClaimTicket {
  roundId: number;
  winner: string;
  prizeAmount: number;
  stakeAmount: number;
  claimed: boolean;
  bump: number;
}

/**
 * Custom hook to fetch and manage raffle state from blockchain
 *
 * Automatically polls for updates every 5 seconds
 */
export const useRaffleState = () => {
  const { publicKey } = useWallet();
  const { program, isReady } = useRaffleProgram();

  const [protocolState, setProtocolState] = useState<ProtocolState | null>(null);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [claimTickets, setClaimTickets] = useState<ClaimTicket[]>([]);  // NEW: User's unclaimed prizes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all state from blockchain
  const fetchState = useCallback(async () => {
    if (!program || !isReady) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch ProtocolState PDA
      const [protocolPda] = getProtocolStatePDA();

      let protocol: any;
      try {
        protocol = await program.account.protocolState.fetch(protocolPda);
        setProtocolState({
          admin: protocol.admin.toString(),
          validator: protocol.validator.toString(),
          currentRound: protocol.currentRound.toNumber(),
          prizeSeedAmount: protocol.prizeSeedAmount.toNumber(),
          totalUnclaimedPrizes: protocol.totalUnclaimedPrizes.toNumber(),
          bump: protocol.bump,
        });
      } catch (err) {
        console.log('ProtocolState not initialized yet');
        setProtocolState(null);
        setLoading(false);
        return;
      }

      // Fetch current RoundState
      if (protocol && protocol.currentRound.toNumber() > 0) {
        const [roundPda] = getRoundStatePDA(protocolPda, protocol.currentRound.toNumber());

        try {
          const round = await program.account.roundState.fetch(roundPda);

          // Convert start_epoch from BN to number safely (it's a timestamp in milliseconds)
          // Use Number() instead of toNumber() to handle large values correctly
          const startEpochMs = Number(round.startEpoch.toString());

          console.log('Round State Fetched:', {
            startEpoch: round.startEpoch.toString(),
            startEpochMs,
            epochInRound: round.epochInRound,
            now: Date.now()
          });

          const endEpochMs = Number(round.endEpoch.toString());

          setRoundState({
            roundId: round.roundId.toNumber(),
            epochInRound: round.epochInRound,
            startEpoch: startEpochMs,
            endEpoch: endEpochMs,
            stakeAccount: round.stakeAccount.toString(),
            totalStakedLamports: round.totalStakedLamports.toNumber(),
            totalPrizeLamports: round.totalPrizeLamports.toNumber(),
            totalTicketsSold: round.totalTicketsSold.toNumber(),
            winner: round.winner ? round.winner.toString() : null,
            winningTicket: round.winningTicket.toNumber(),
            isComplete: round.isComplete,
            prizeClaimed: round.prizeClaimed,
            vrfRequest: round.vrfRequest ? round.vrfRequest.toString() : null,
            bump: round.bump,
          });
        } catch (err) {
          console.log('RoundState not found for current round');
          setRoundState(null);
        }
      } else {
        setRoundState(null);
      }

      // Fetch UserAccount if wallet is connected
      if (publicKey) {
        const [userPda] = getUserAccountPDA(publicKey);

        try {
          const user = await program.account.userAccount.fetch(userPda);
          setUserAccount({
            owner: user.owner.toString(),
            balance: user.balance.toNumber(),
            ticketStart: user.ticketStart.toNumber(),
            ticketEnd: user.ticketEnd.toNumber(),
            snapshotBalances: user.snapshotBalances.map((b: any) => b.toNumber()),
            snapshotsRecordedMask: user.snapshotsRecordedMask,
            roundJoined: user.roundJoined.toNumber(),
            pendingWithdrawalAmount: user.pendingWithdrawalAmount.toNumber(),
            pendingWithdrawalRound: user.pendingWithdrawalRound.toNumber(),
            bump: user.bump,
          });
        } catch (err) {
          // User account doesn't exist yet (hasn't deposited)
          setUserAccount(null);
        }
      } else {
        setUserAccount(null);
      }

      // Fetch user's ClaimTickets (unclaimed prizes from past rounds)
      if (publicKey && protocol) {
        const tickets: ClaimTicket[] = [];
        const currentRoundId = protocol.currentRound.toNumber();

        // Check for ClaimTickets from recent rounds (last 10 rounds)
        for (let i = Math.max(1, currentRoundId - 10); i <= currentRoundId; i++) {
          try {
            const [claimTicketPda] = getClaimTicketPDA(i, publicKey);
            const claimTicket = await program.account.claimTicket.fetch(claimTicketPda);

            // Only include unclaimed tickets
            if (!claimTicket.claimed) {
              tickets.push({
                roundId: claimTicket.roundId.toNumber(),
                winner: claimTicket.winner.toString(),
                prizeAmount: claimTicket.prizeAmount.toNumber(),
                stakeAmount: claimTicket.stakeAmount.toNumber(),
                claimed: claimTicket.claimed,
                bump: claimTicket.bump,
              });
            }
          } catch (err) {
            // ClaimTicket doesn't exist for this round or user - that's fine
          }
        }

        setClaimTickets(tickets);
      } else {
        setClaimTickets([]);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching state:', err);
      setError(err.message || 'Failed to fetch blockchain state');
      setLoading(false);
    }
  }, [program, isReady, publicKey]);

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      fetchState();
    }, 5000);

    return () => clearInterval(interval);
  }, [isReady, fetchState]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true);
    fetchState();
  }, [fetchState]);

  return {
    protocolState,
    roundState,
    userAccount,
    claimTickets,  // NEW: Unclaimed prizes
    loading,
    error,
    refresh,
    isReady,
  };
};
