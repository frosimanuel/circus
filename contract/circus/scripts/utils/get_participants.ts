import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export interface ParticipantInfo {
  pubkey: PublicKey;
  owner: PublicKey;
  balance: number;
  ticketStart: number;
  ticketEnd: number;
  roundJoined: number;
}

/**
 * Get all participants for a specific round
 * This properly handles UserAccount querying
 */
export async function getParticipants(
  program: Program,
  roundId: number
): Promise<ParticipantInfo[]> {
  const participants: ParticipantInfo[] = [];

  try {
    // Use Anchor's built-in method to fetch all UserAccounts
    console.log(`  Fetching all UserAccounts...`);

    const userAccounts = await (program.account as any).userAccount.all();

    console.log(`  Found ${userAccounts.length} UserAccount(s)`);

    // Filter for this round and with balance > 0
    for (const account of userAccounts) {
      const roundJoined = account.account.roundJoined.toNumber();
      const balance = account.account.balance.toNumber();

      console.log(`  - UserAccount ${account.publicKey.toString().slice(0, 8)}... round=${roundJoined}, balance=${balance / 1e9} SOL`);

      if (roundJoined === roundId && balance > 0) {
        participants.push({
          pubkey: account.publicKey,
          owner: account.account.owner,
          balance: balance,
          ticketStart: account.account.ticketStart.toNumber(),
          ticketEnd: account.account.ticketEnd.toNumber(),
          roundJoined: roundJoined,
        });
      }
    }

    console.log(`  Filtered to ${participants.length} participants in Round ${roundId}`);

    return participants;
  } catch (err: any) {
    console.error("Error getting participants:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    return [];
  }
}

/**
 * Get total participant count for display
 */
export async function getParticipantCount(
  program: Program,
  roundId: number
): Promise<number> {
  const participants = await getParticipants(program, roundId);
  return participants.length;
}
