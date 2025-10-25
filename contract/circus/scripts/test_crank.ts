import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { getParticipants } from "./utils/get_participants";

const PROGRAM_ID = new PublicKey("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

async function testCrank() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("🔧 Testing Crank Instruction");
  console.log("====================================\n");

  try {
    const protocol = await (program.account as any).protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const roundBefore = await (program.account as any).roundState.fetch(roundPda);

    console.log("📊 Round State BEFORE Crank:");
    console.log("  Round ID:", roundBefore.roundId.toNumber());
    console.log("  Epoch:", roundBefore.epochInRound);
    console.log("  Is Complete:", roundBefore.isComplete);
    console.log("  Total Tickets:", roundBefore.totalTicketsSold.toNumber());

    const startTime = Number(roundBefore.startEpoch.toString());
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

    console.log("\n⏱️  Elapsed:", elapsedMinutes.toFixed(2), "minutes");

    // Get all participants for winner selection
    console.log("\n👥 Finding participants...");
    const participants = await getParticipants(program, currentRoundId);

    console.log("\n✅ Participants in Round", currentRoundId + ":");
    participants.forEach((p, i) => {
      const numTickets = p.ticketEnd - p.ticketStart + 1;
      console.log(`  ${i + 1}. ${p.owner.toString().slice(0, 8)}... - ${numTickets} tickets (${p.balance / LAMPORTS_PER_SOL} SOL)`);
    });

    const userAccountPubkeys = participants.map(p => p.pubkey);

    // Call crank
    console.log("\n⚙️  Calling crank instruction...");

    const tx = await program.methods
      .crank()
      .accounts({
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts(
        userAccountPubkeys.map(pubkey => ({ pubkey, isSigner: false, isWritable: false }))
      )
      .rpc();

    console.log("✅ Transaction:", tx);

    await provider.connection.confirmTransaction(tx, "confirmed");

    // Check round state after
    const roundAfter = await (program.account as any).roundState.fetch(roundPda);

    console.log("\n📊 Round State AFTER Crank:");
    console.log("  Epoch:", roundAfter.epochInRound, "(was", roundBefore.epochInRound + ")");
    console.log("  Is Complete:", roundAfter.isComplete, "(was", roundBefore.isComplete + ")");
    console.log("  Winner:", roundAfter.winner?.toString() || "None");
    console.log("  Winning Ticket:", roundAfter.winningTicket.toNumber());

    if (roundAfter.epochInRound > roundBefore.epochInRound) {
      console.log("\n✅✅✅ SUCCESS! Epoch advanced from", roundBefore.epochInRound, "to", roundAfter.epochInRound);
    }

    if (!roundBefore.isComplete && roundAfter.isComplete) {
      console.log("\n🎉🎉🎉 ROUND FINALIZED! Winner selected:", roundAfter.winner.toString());
    }

    if (roundAfter.epochInRound === roundBefore.epochInRound && !roundAfter.isComplete) {
      console.log("\n⏳ No change - not enough time elapsed yet");
      console.log("  Wait for next epoch boundary or finalization time");
    }

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.join("\n"));
    }
  }
}

testCrank();
