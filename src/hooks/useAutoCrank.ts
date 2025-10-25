import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRaffleState } from './useRaffleState';
import { useRaffleTransactions } from './useRaffleTransactions';
import { useRaffleProgram } from './useRaffleProgram';
import { getProtocolStatePDA } from '../config/solana';

const EPOCH_DURATION_SECONDS = 120; // 2 minutes
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

/**
 * Automatically calls crank when epochs expire or round needs finalization
 * Also automatically initializes new rounds after completion (admin only)
 * Runs in the background to ensure epochs advance and winners are selected on time
 */
export const useAutoCrank = () => {
  const { publicKey } = useWallet();
  const { program } = useRaffleProgram();
  const { roundState, isReady, refresh } = useRaffleState();
  const { callCrank, isProcessing } = useRaffleTransactions();
  const lastCrankAttempt = useRef<number>(0);
  const lastRoundInitAttempt = useRef<number>(0);
  const isInitializingRound = useRef<boolean>(false);

  useEffect(() => {
    if (!isReady || !roundState) {
      return;
    }

    const checkAndCrank = async () => {
      const now = Date.now();

      // Check if round is complete and needs new round initialization
      if (roundState.isComplete && !isInitializingRound.current) {
        // Auto-initialize new round (permissionless - anyone can do it!)
        if (program && publicKey && now - lastRoundInitAttempt.current > 10000) {
          try {
            const nextRoundId = roundState.roundId + 1;

            console.log('🔄 Auto-initializing new round:', nextRoundId);
            isInitializingRound.current = true;
            lastRoundInitAttempt.current = now;

            const { Keypair, SystemProgram } = await import('@solana/web3.js');
            const { BN } = await import('@coral-xyz/anchor');
            const { getProtocolStatePDA, getRoundStatePDA } = await import('../config/solana');

            const [protocolPda] = getProtocolStatePDA();
            const [roundPda] = getRoundStatePDA(protocolPda, nextRoundId);
            const stakeAccount = Keypair.generate();
            const randomSeed = Date.now();

            const tx = await program.methods
              .initRound(new BN(nextRoundId), new BN(randomSeed))
              .accountsPartial({
                payer: publicKey,
                stakeAccount: stakeAccount.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .rpc();

            console.log('✅ New round initialized:', tx);
            setTimeout(() => {
              refresh();
              isInitializingRound.current = false;
            }, 2000);
            return;
          } catch (error) {
            console.error('❌ Auto-init round error:', error);
            isInitializingRound.current = false;
          }
        }
        return; // Don't run crank if round is complete
      }

      // Don't spam - wait at least 15 seconds between crank attempts
      if (now - lastCrankAttempt.current < 15000) {
        return;
      }

      // Don't call if already processing
      if (isProcessing) {
        return;
      }

      const currentTime = now;
      const startEpoch = roundState.startEpoch;
      const currentEpoch = roundState.epochInRound;

      // Calculate elapsed time
      const elapsedMs = currentTime - startEpoch;
      const epochsPassed = Math.floor(elapsedMs / (EPOCH_DURATION_SECONDS * 1000));
      const expectedEpoch = Math.min(epochsPassed + 1, 3);

      // Check if epoch should advance
      const shouldAdvanceEpoch = expectedEpoch > currentEpoch;

      // Check if round should finalize (after epoch 3 ends)
      const epoch3EndTime = startEpoch + (3 * EPOCH_DURATION_SECONDS * 1000);
      const shouldFinalize = currentEpoch >= 3 && currentTime >= epoch3EndTime && roundState.totalTicketsSold > 0;

      if (shouldAdvanceEpoch || shouldFinalize) {
        console.log('🔄 Auto-crank triggered:', {
          shouldAdvanceEpoch,
          shouldFinalize,
          currentEpoch,
          expectedEpoch,
          currentTime: new Date(currentTime).toISOString(),
          epoch3EndTime: new Date(epoch3EndTime).toISOString(),
        });

        lastCrankAttempt.current = now;

        try {
          const result = await callCrank();
          if (result.success) {
            console.log('✅ Auto-crank successful:', result.signature);
            // Refresh state to show updated epoch/winner
            setTimeout(() => refresh(), 2000);
          } else {
            console.warn('⚠️ Auto-crank failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Auto-crank error:', error);
        }
      }
    };

    // Initial check
    checkAndCrank();

    // Set up interval
    const interval = setInterval(checkAndCrank, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roundState, isReady, callCrank, isProcessing, refresh, program, publicKey]);
};
