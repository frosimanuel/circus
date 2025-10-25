import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "bn.js";

const PROGRAM_ID = new PublicKey("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

async function initNewRound() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const admin = provider.wallet.publicKey;

  console.log("🎪 Initializing New Round");
  console.log("=========================\n");

  try {
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      PROGRAM_ID
    );

    const protocol = await (program.account as any).protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    console.log("Current Round:", currentRoundId);

    // Initialize next round
    const nextRoundId = currentRoundId + 1;
    const startEpoch = Date.now();
    const stakeAccount = Keypair.generate();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(nextRoundId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    console.log("\n📝 Initializing Round #" + nextRoundId);
    console.log("Round PDA:", roundPda.toString());
    console.log("Start time:", new Date(startEpoch).toISOString());

    const tx = await program.methods
      .initRound(new BN(nextRoundId), new BN(startEpoch))
      .accounts({
        admin: admin,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Round initialized!");
    console.log("Transaction:", tx);

    await provider.connection.confirmTransaction(tx, "confirmed");

    // Verify
    const round = await (program.account as any).roundState.fetch(roundPda);
    console.log("\n📊 Round State:");
    console.log("  Round ID:", round.roundId.toNumber());
    console.log("  Epoch:", round.epochInRound);
    console.log("  Tickets Sold:", round.totalTicketsSold.toNumber());

    console.log("\n✅✅✅ Ready for testing!");
    console.log("\nYou can now:");
    console.log("1. Buy tickets: npx ts-node scripts/test_full_flow.ts");
    console.log("2. Call crank: npx ts-node scripts/test_crank.ts");

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.join("\n"));
    }
  }
}

initNewRound();
