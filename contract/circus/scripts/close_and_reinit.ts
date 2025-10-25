import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("GCciitHtA142hzsAWxKM3jJKQEV7amqMrQbjfk5X5hFk");

async function closeAndReinit() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  const admin = provider.wallet.publicKey;

  // Get protocol state PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("🔧 Close and Reinitialize Protocol");
  console.log("====================================");
  console.log("Admin:", admin.toString());
  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Protocol PDA:", protocolPda.toString());

  try {
    // Step 1: Check existing account
    const existingAccount = await provider.connection.getAccountInfo(protocolPda);

    if (existingAccount) {
      console.log("\n📋 Existing ProtocolState:");
      console.log("   Size:", existingAccount.data.length, "bytes");
      console.log("   Expected size:", 8 + 97, "bytes");

      if (existingAccount.data.length !== 8 + 97) {
        console.log("   ⚠️  Size mismatch detected!");

        // Try to fetch and check unclaimed prizes
        try {
          const protocol = await (program.account as any).protocolState.fetch(protocolPda);
          console.log("\n📊 Protocol State:");
          console.log("   Current Round:", protocol.currentRound.toNumber());

          // Check if totalUnclaimedPrizes exists (new field)
          if (protocol.totalUnclaimedPrizes !== undefined) {
            console.log("   Total Unclaimed Prizes:", protocol.totalUnclaimedPrizes.toNumber());

            if (protocol.totalUnclaimedPrizes.toNumber() > 0) {
              console.error("\n❌ Cannot close: Unclaimed prizes exist!");
              console.error("   Users must claim prizes first before closing.");
              return;
            }
          }

          // Step 2: Close the old account
          console.log("\n🗑️  Closing old ProtocolState account...");

          const tx = await program.methods
            .closeProtocolState()
            .accounts({
              admin: admin,
              protocolState: protocolPda,
            })
            .rpc();

          console.log("✅ Old account closed!");
          console.log("   Transaction:", tx);

          // Wait for confirmation
          await provider.connection.confirmTransaction(tx, "confirmed");

          console.log("   Rent recovered to admin wallet");
        } catch (err: any) {
          console.error("\n❌ Error closing account:", err.message);
          if (err.message.includes("UnclaimedPrizesExist")) {
            console.error("   Cannot close: Users have unclaimed prizes!");
            return;
          }
          if (err.message.includes("buffer")) {
            console.log("   ⚠️  Cannot deserialize old account (expected due to size mismatch)");
            console.log("   Proceeding with manual close...");

            // The old account can't be deserialized, but we can still try to close it
            // This will fail because the close instruction needs to deserialize
            console.error("\n❌ Cannot automatically close incompatible account.");
            console.error("   The account structure has changed and cannot be deserialized.");
            console.error("\n📋 MANUAL FIX REQUIRED:");
            console.error("   Option 1: Use a new program ID (redeploy with new keypair)");
            console.error("   Option 2: Use Solana CLI to close program (if you're upgrade authority)");
            console.error(`   Command: solana program close ${PROGRAM_ID} --bypass-warning`);
            return;
          }
          throw err;
        }
      } else {
        console.log("   ✅ Account size is correct!");
        const protocol = await (program.account as any).protocolState.fetch(protocolPda);
        console.log("   Current Round:", protocol.currentRound.toNumber());
        console.log("   Already initialized correctly!");
        return;
      }
    } else {
      console.log("\n✅ No existing ProtocolState found.");
    }

    // Step 3: Initialize with new structure
    console.log("\n🚀 Initializing new ProtocolState...");

    const validator = admin; // Using same wallet as validator for testing

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

    // Verify the new account
    const newAccount = await provider.connection.getAccountInfo(protocolPda);
    console.log("\n✅ New ProtocolState created:");
    console.log("   Size:", newAccount?.data.length, "bytes");
    console.log("   Expected:", 8 + 97, "bytes");

    if (newAccount?.data.length === 8 + 97) {
      console.log("   ✅✅✅ SUCCESS! Account size is correct!");
    } else {
      console.log("   ⚠️  Size mismatch - check contract SIZE constants");
    }

    // Step 4: Seed prize pool
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
    console.log("   Transaction:", seedTx);

    // Step 5: Initialize Round #1
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
    console.log("   Transaction:", roundTx);
    console.log("   Round PDA:", roundPda.toString());
    console.log("   Start time:", new Date(startEpoch).toISOString());

    console.log("\n✅✅✅ PROTOCOL READY FOR TESTING! ✅✅✅");
    console.log("\nNext steps:");
    console.log("1. Try buying tickets from the frontend");
    console.log("2. Verify the deposit transaction succeeds");
    console.log("3. Check that account sizes are correct");

  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    if (err.logs) {
      console.error("Logs:", err.logs);
    }
  }
}

closeAndReinit();
