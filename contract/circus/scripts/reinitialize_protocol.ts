import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("GCciitHtA142hzsAWxKM3jJKQEV7amqMrQbjfk5X5hFk");

async function reinitializeProtocol() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const admin = provider.wallet.publicKey;
  const validator = admin; // Using same key for testing

  // Get protocol state PDA
  const [protocolPda, protocolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("🔧 Reinitializing Protocol on Devnet");
  console.log("====================================");
  console.log("Admin:", admin.toString());
  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Protocol PDA:", protocolPda.toString());

  try {
    // Step 1: Check if account exists
    const existingAccount = await provider.connection.getAccountInfo(protocolPda);

    if (existingAccount) {
      console.log("\n⚠️  Old ProtocolState exists (size:", existingAccount.data.length, "bytes)");
      console.log("⚠️  New contract expects:", 8 + 97, "bytes");

      // Step 2: Close the old account by transferring lamports back to admin
      console.log("\n🗑️  Closing old account...");

      try {
        // Try to use a close instruction if one exists, otherwise we'll need to do it manually
        // For now, we'll create a helper instruction or use solana CLI
        console.log("❌ Cannot automatically close PDA account from script.");
        console.log("\n📋 MANUAL STEPS REQUIRED:");
        console.log("Run this command to check the program's upgrade authority:");
        console.log(`   solana program show ${PROGRAM_ID} --url devnet`);
        console.log("\nIf you are the authority, you can:");
        console.log("1. Add a 'close_protocol_state' admin instruction to the contract");
        console.log("2. Or redeploy with a new program ID");
        console.log("\n💡 RECOMMENDED WORKAROUND:");
        console.log("Since we're on devnet, the easiest solution is to:");
        console.log("1. Generate a new keypair: solana-keygen new -o ./new-keypair.json");
        console.log("2. Update Anchor.toml with the new keypair");
        console.log("3. Redeploy: anchor build && anchor deploy");
        console.log("4. Update frontend PROGRAM_ID");
        return;
      } catch (closeErr) {
        console.error("Close error:", closeErr);
        return;
      }
    }

    // Step 3: Initialize with new structure
    console.log("\n✅ No existing account. Initializing...");

    const prizeSeedAmount = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

    const tx = await program.methods
      .initialize(prizeSeedAmount)
      .accounts({
        admin: admin,
        validator: validator,
        protocolState: protocolPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol initialized!");
    console.log("Transaction signature:", tx);

    // Verify the new account
    const newAccount = await provider.connection.getAccountInfo(protocolPda);
    console.log("\n✅ New account size:", newAccount?.data.length, "bytes");
    console.log("Expected:", 8 + 97, "bytes");

    if (newAccount?.data.length === 8 + 97) {
      console.log("✅✅✅ SUCCESS! Protocol reinitialized correctly!");
    } else {
      console.log("⚠️  Size mismatch - please check the contract");
    }

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs);
    }
  }
}

reinitializeProtocol();
