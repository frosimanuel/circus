import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { getParticipants } from "./utils/get_participants";

const PROGRAM_ID = new PublicKey("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

async function checkEpochAdvancement() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("🔍 Checking Epoch Auto-Advancement");
  console.log("====================================\n");

  try {
    const protocol = await (program.account as any).protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    console.log("Protocol State:");
    console.log("  Current Round:", currentRoundId);
    console.log("  Prize Seed:", protocol.prizeSeedAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const round = await (program.account as any).roundState.fetch(roundPda);

    const startTime = Number(round.startEpoch.toString());
    const currentTime = Date.now();
    const elapsedMs = currentTime - startTime;
    const elapsedMinutes = elapsedMs / (1000 * 60);

    console.log("\n📊 Round State:");
    console.log("  Round ID:", round.roundId.toNumber());
    console.log("  Current Epoch:", round.epochInRound);
    console.log("  Total Tickets:", round.totalTicketsSold.toNumber());
    console.log("  Total Staked:", round.totalStakedLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  Is Complete:", round.isComplete);
    console.log("  Winner:", round.winner?.toString() || "None");

    console.log("\n⏱️  Timing:");
    console.log("  Round Start:", new Date(startTime).toISOString());
    console.log("  Current Time:", new Date(currentTime).toISOString());
    console.log("  Elapsed:", elapsedMinutes.toFixed(2), "minutes");
    console.log("  Epoch Duration: 2 minutes");

    // Calculate expected epoch
    const EPOCH_DURATION_MS = 120 * 1000; // 2 minutes
    const epochsPassed = Math.floor(elapsedMs / EPOCH_DURATION_MS);
    const expectedEpoch = Math.min(epochsPassed + 1, 3);

    console.log("\n🎯 Expected Epoch Based on Time:");
    console.log("  Epochs passed:", epochsPassed);
    console.log("  Expected epoch:", expectedEpoch);
    console.log("  Actual epoch:", round.epochInRound);

    if (round.epochInRound !== expectedEpoch) {
      console.log("\n⚠️  WARNING: Epoch mismatch detected!");
      console.log("  The epoch has NOT auto-advanced correctly.");
      console.log("\n📋 Possible Reasons:");
      console.log("  1. No deposit transactions made since epoch should have advanced");
      console.log("  2. Auto-advancement only triggers during deposit transactions");
      console.log("  3. Frontend may be reading stale data");
      console.log("\n💡 Solution:");
      console.log("  Make a small deposit (0.01 SOL) to trigger epoch check");
    } else {
      console.log("\n✅ Epoch is correct for current time!");
    }

    // Check time until next epoch or finalization
    if (round.epochInRound < 3 && !round.isComplete) {
      const nextEpochTime = startTime + ((round.epochInRound) * EPOCH_DURATION_MS);
      const timeUntilNext = nextEpochTime - currentTime;
      const minutesUntilNext = timeUntilNext / (1000 * 60);

      console.log("\n⏳ Time Until Next Epoch:");
      console.log("  Next epoch starts at:", new Date(nextEpochTime).toISOString());
      console.log("  Time remaining:", minutesUntilNext.toFixed(2), "minutes");

      if (minutesUntilNext <= 0) {
        console.log("\n  ⚠️  Next epoch should have started! Make a deposit to trigger update.");
      }
    }

    if (round.epochInRound >= 3 && !round.isComplete) {
      const epoch3EndTime = startTime + (3 * EPOCH_DURATION_MS);
      const timeUntilFinalize = epoch3EndTime - currentTime;
      const minutesUntilFinalize = timeUntilFinalize / (1000 * 60);

      console.log("\n🏁 Round Finalization:");
      console.log("  Epoch 3 ends at:", new Date(epoch3EndTime).toISOString());
      console.log("  Time remaining:", minutesUntilFinalize.toFixed(2), "minutes");

      if (minutesUntilFinalize <= 0) {
        console.log("\n  ⚠️  Round should be finalized! Make a deposit to trigger winner selection.");
      }
    }

    // Get list of participants
    console.log("\n👥 Checking Participants...");

    const participants = await getParticipants(program, currentRoundId);

    console.log("\n✅ Participants in Round", currentRoundId + ":");
    participants.forEach((p, i) => {
      const numTickets = p.ticketEnd - p.ticketStart + 1;
      console.log(`  ${i + 1}. ${p.owner.toString().slice(0, 8)}... - ${numTickets} tickets (${p.balance / LAMPORTS_PER_SOL} SOL)`);
    });

    console.log("\n  📊 Ticket Distribution:");
    console.log("    Total tickets sold:", round.totalTicketsSold.toNumber());
    console.log("    Participants:", participants.length);
    console.log("    (Each participant may have multiple tickets)");

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.join("\n"));
    }
  }
}

checkEpochAdvancement();
