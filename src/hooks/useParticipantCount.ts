import { useEffect, useState } from 'react';
import { useRaffleProgram } from './useRaffleProgram';

/**
 * Hook to get the real participant count for the current round
 * Uses the proper Anchor method to query UserAccounts
 */
export const useParticipantCount = (roundId: number | null) => {
  const { program } = useRaffleProgram();
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!program || roundId === null) {
        setParticipantCount(0);
        return;
      }

      setLoading(true);
      try {
        // Use Anchor's built-in method to fetch all UserAccounts
        const allAccounts = await program.account.userAccount.all();

        // Filter for users who joined this round and have a balance
        const participants = allAccounts.filter(
          (acc) =>
            acc.account.roundJoined.toNumber() === roundId &&
            acc.account.balance.toNumber() > 0
        );

        setParticipantCount(participants.length);
      } catch (error) {
        console.error('Error fetching participants:', error);
        setParticipantCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [program, roundId]);

  return { participantCount, loading };
};
