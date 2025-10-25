import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("GCciitHtA142hzsAWxKM3jJKQEV7amqMrQbjfk5X5hFk");

async function checkAccount() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  console.log("Admin:", provider.wallet.publicKey.toString());

  // Get protocol state PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("Protocol PDA:", protocolPda.toString());

  try {
    // Check if protocol exists
    const account = await provider.connection.getAccountInfo(protocolPda);
    if (account) {
      console.log("⚠️  WARNING: ProtocolState already exists!");
      console.log("Account size:", account.data.length);
      console.log("Expected size:", 8 + 97); // discriminator + SIZE

      if (account.data.length !== 8 + 97) {
        console.log("❌ Size mismatch! Old account detected.");
        console.log("\n📋 STEPS TO FIX:");
        console.log("1. Close the old account:");
        console.log(`   solana program close ${PROGRAM_ID} --bypass-warning`);
        console.log("\n2. Or close just the ProtocolState PDA (recommended):");
        console.log("   Run the close_protocol.ts script");
        console.log("\n3. Then reinitialize:");
        console.log("   anchor run init-protocol");
      } else {
        console.log("✅ Account size is correct!");
      }
    } else {
      console.log("✅ No existing ProtocolState found. Ready to initialize!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkAccount();
