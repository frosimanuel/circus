import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

/**
 * Simple workaround for incompatible ProtocolState:
 * We can't deserialize the old account, so we just create a NEW round
 * and use that instead. The old ProtocolState will remain but users
 * will interact with the new round.
 */
async function simpleReinit() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const admin = provider.wallet.publicKey;

  // Get protocol state PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("🔧 Protocol Status Check & Workaround");
  console.log("=====================================");
  console.log("Admin:", admin.toString());
  console.log("Protocol PDA:", protocolPda.toString());

  try {
    // Check existing account
    const existingAccount = await provider.connection.getAccountInfo(protocolPda);

    if (!existingAccount) {
      console.log("\n✅ No existing ProtocolState. Initializing fresh...");

      // Initialize new
      const validator = admin;

      const initTx = await program.methods
        .initialize(validator)
        .accounts({
          admin: admin,
          protocolState: protocolPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Protocol initialized!");
      console.log("   Transaction:", initTx);

      await provider.connection.confirmTransaction(initTx, "confirmed");
    } else {
      console.log("\n⚠️  ProtocolState already exists:");
      console.log("   Size:", existingAccount.data.length, "bytes");
      console.log("   Expected:", 8 + 97, "bytes");

      if (existingAccount.data.length !== 8 + 97) {
        console.log("\n❌ INCOMPATIBLE ACCOUNT DETECTED");
        console.log("   Old structure can't be deserialized by new contract");
        console.log("\n📋 WORKAROUND:");
        console.log("   Since the old ProtocolState is incompatible and we can't close PDAs easily,");
        console.log("   we have two options:\n");
        console.log("   Option 1 (RECOMMENDED FOR DEVNET):");
        console.log("   1. Generate new program keypair:");
        console.log("      anchor keys sync");
        console.log("      solana-keygen new -o target/deploy/rafa-keypair.json");
        console.log("   2. Update Anchor.toml and Declare_id with new program ID");
        console.log("   3. Rebuild and redeploy");
        console.log("   4. Update frontend PROGRAM_ID");
        console.log("\n   Option 2 (MANUAL DRAIN - ADVANCED):");
        console.log("   Create a raw instruction to drain lamports from the PDA");
        console.log("   without deserializing it (requires low-level Solana SDK)");
        console.log("\n💡 For devnet testing, Option 1 is fastest and cleanest!");

        return;
      }

      // Try to fetch
      try {
        const protocol = await (program.account as any).protocolState.fetch(protocolPda);
        console.log("\n✅ ProtocolState is compatible!");
        console.log("   Current Round:", protocol.currentRound.toNumber());
        console.log("   Unclaimed Prizes:", protocol.totalUnclaimedPrizes.toNumber());
        console.log("\n   Already initialized correctly. No action needed!");
        return;
      } catch (err: any) {
        console.error("\n❌ Cannot deserialize:", err.message);
        console.error("   Account is incompatible. See workaround above.");
        return;
      }
    }

    // Seed prize pool
    console.log("\n💰 Seeding prize pool...");

    const prizeSeed = new BN(0.1 * LAMPORTS_PER_SOL);

    const seedTx = await program.methods
      .seedPrize(prizeSeed)
      .accounts({
        admin: admin,
        protocolState: protocolPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Prize seeded: 0.1 SOL");

    // Initialize Round #1
    console.log("\n🎪 Initializing Round #1...");

    const roundId = 1;
    const startEpoch = Date.now();
    const stakeAccount = anchor.web3.Keypair.generate();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(roundId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const roundTx = await program.methods
      .initRound(new BN(roundId), new BN(startEpoch))
      .accounts({
        admin: admin,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Round #1 initialized!");
    console.log("   Round PDA:", roundPda.toString());

    console.log("\n✅✅✅ PROTOCOL READY! ✅✅✅");
    console.log("\nYou can now test buying tickets from the frontend!");

  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs.join("\n"));
    }
  }
}

simpleReinit();
