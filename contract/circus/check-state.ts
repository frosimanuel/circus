import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rafa } from "./target/types/rafa";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafa as Program<Rafa>;

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  try {
    // Check if protocol is initialized
    const state = await program.account.protocolState.fetch(protocolPda);
    console.log("\n✅ Protocol State:");
    console.log("  Admin:", state.admin.toString());
    console.log("  Current Round:", state.currentRound.toNumber());
    console.log("  Prize Seed Amount:", state.prizeSeedAmount.toNumber() / 1e9, "SOL");

    // Check current round
    if (state.currentRound.toNumber() > 0) {
      const roundId = state.currentRound.toNumber();
      const [roundPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("round"),
          protocolPda.toBuffer(),
          Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8)),
        ],
        program.programId
      );

      try {
        const round = await program.account.roundState.fetch(roundPda);
        console.log("\n✅ Round State (Round #" + roundId + "):");
        console.log("  Epoch in Round:", round.epochInRound);
        console.log("  Start Epoch:", new Date(Number(round.startEpoch)).toISOString());
        console.log("  Total Prize Lamports:", round.totalPrizeLamports.toNumber() / 1e9, "SOL");
        console.log("  Total Tickets Sold:", round.totalTicketsSold.toNumber());
        console.log("  Winner:", round.winner ? round.winner.toString() : "None");
        console.log("  Is Complete:", round.isComplete);
      } catch (err) {
        console.log("\n❌ Round #" + roundId + " not found");
      }
    }
  } catch (err) {
    console.log("\n❌ Protocol not initialized yet");
  }
}

main();
