import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Rafa } from "../target/types/rafa";

/**
 * Initialize Protocol on Devnet
 *
 * This script initializes the protocol, seeds prize, and creates the first round
 */

async function main() {
  console.log("🚀 Initializing Protocol on Devnet\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Rafa as Program<Rafa>;

  console.log("🔗 RPC:", provider.connection.rpcEndpoint);
  console.log("🔑 Admin Wallet:", provider.wallet.publicKey.toBase58());
  console.log("💻 Program ID:", program.programId.toBase58());
  console.log("");

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  console.log("📍 Protocol PDA:", protocolPda.toBase58());
  console.log("");

  // Check if already initialized
  try {
    const existingState = await program.account.protocolState.fetch(protocolPda);
    console.log("⚠️  Protocol already initialized!");
    console.log("   Current Round:", existingState.currentRound.toString());
    console.log("   Admin:", existingState.admin.toBase58());
    process.exit(0);
  } catch (e) {
    console.log("✅ Protocol not initialized yet, proceeding...\n");
  }

  // Step 1: Initialize Protocol
  console.log("Step 1: Initializing protocol...");
  const validator = Keypair.generate().publicKey; // dummy validator for now

  try {
    const tx = await program.methods
      .initialize(validator)
      .accountsPartial({
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol initialized!");
    console.log("   Transaction:", tx);
  } catch (e: any) {
    console.error("❌ Initialization failed:", e.message);
    process.exit(1);
  }

  // Step 2: Seed Prize Pool
  console.log("\nStep 2: Seeding prize pool...");
  const prizeAmount = new anchor.BN(100_000_000); // 0.1 SOL

  try {
    const tx = await program.methods
      .seedPrize(prizeAmount)
      .accountsPartial({
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Prize pool seeded with 0.1 SOL");
    console.log("   Transaction:", tx);
  } catch (e: any) {
    console.error("❌ Prize seeding failed:", e.message);
  }

  // Step 3: Initialize First Round
  console.log("\nStep 3: Initializing Round #1...");
  const roundId = 1;
  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))
    ],
    program.programId
  );

  const stakeAccount = Keypair.generate();
  const randomSeed = Date.now();

  try {
    const tx = await program.methods
      .initRound(new anchor.BN(roundId), new anchor.BN(randomSeed))
      .accountsPartial({
        admin: provider.wallet.publicKey,
        stakeAccount: stakeAccount.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Round #1 initialized");
    console.log("   Round PDA:", roundPda.toBase58());
    console.log("   Transaction:", tx);
  } catch (e: any) {
    console.error("❌ Round initialization failed:", e.message);
  }

  // Display final state
  console.log("\n" + "=".repeat(70));
  console.log("🎉 PROTOCOL READY FOR TESTING!");
  console.log("=".repeat(70));

  const finalState = await program.account.protocolState.fetch(protocolPda);
  console.log("\n🌐 Protocol State:");
  console.log("   PDA:", protocolPda.toBase58());
  console.log("   Admin:", finalState.admin.toBase58());
  console.log("   Current Round:", finalState.currentRound.toString());
  console.log("   Prize Seed:", (finalState.prizeSeedAmount.toNumber() / 1e9).toFixed(3), "SOL");
  console.log("   Current Epoch:", finalState.currentEpoch);

  console.log("\n💡 Next Steps:");
  console.log("   1. Open frontend: http://localhost:5174/");
  console.log("   2. Connect your wallet (set to DEVNET)");
  console.log("   3. Navigate to Staking Raffle");
  console.log("   4. Make a deposit!");
  console.log("\n🎮 Ready to play!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
