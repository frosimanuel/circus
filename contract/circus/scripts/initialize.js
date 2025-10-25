/**
 * Protocol Initialization Script
 *
 * Initializes the protocol after deployment
 * Usage: node scripts/initialize.js <environment>
 * Example: node scripts/initialize.js devnet
 */

const anchor = require("@coral-xyz/anchor");
const { Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Load environment config
function loadConfig(env) {
  const configPath = path.join(__dirname, "../config/environments.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (!config[env]) {
    throw new Error(`Environment "${env}" not found in config`);
  }

  return config[env];
}

async function main() {
  const environment = process.argv[2] || "devnet";
  console.log("═".repeat(70));
  console.log(`🎬 PROTOCOL INITIALIZATION - ${environment.toUpperCase()}`);
  console.log("═".repeat(70));
  console.log("");

  // Load configuration
  const config = loadConfig(environment);

  // Set Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Rafa;

  console.log("📋 Configuration:");
  console.log(`   Network: ${config.network}`);
  console.log(`   Program ID: ${program.programId.toBase58()}`);
  console.log(`   Admin: ${provider.wallet.publicKey.toBase58()}`);
  console.log(`   Prize Seed: ${config.prizeSeedAmount} SOL`);
  console.log("");

  // Derive Protocol PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  console.log("📍 Protocol PDA:", protocolPda.toBase58());
  console.log("");

  // Check if already initialized
  console.log("🔍 Checking initialization status...");
  try {
    const protocolState = await program.account.protocolState.fetch(protocolPda);
    console.log("⚠️  Protocol already initialized!");
    console.log(`   Admin: ${protocolState.admin.toBase58()}`);
    console.log(`   Current Round: ${protocolState.currentRound.toString()}`);
    console.log(`   Prize Seed: ${(protocolState.prizeSeedAmount.toNumber() / 1e9).toFixed(3)} SOL`);
    console.log("");
    console.log("❌ Skipping initialization. Use manage script to seed more prize or init rounds.");
    return;
  } catch (e) {
    console.log("✅ Protocol not initialized yet");
  }
  console.log("");

  // Step 1: Initialize Protocol
  console.log("═".repeat(70));
  console.log("STEP 1: Initialize Protocol");
  console.log("═".repeat(70));
  console.log("");

  // Generate or use configured validator
  let validatorPubkey;
  if (config.validator === "VALIDATOR_PUBKEY_PLACEHOLDER" ||
      config.validator === "LOCAL_VALIDATOR_PUBKEY") {
    console.log("⚠️  No validator configured, generating random validator for testing...");
    validatorPubkey = Keypair.generate().publicKey;
    console.log(`   Generated: ${validatorPubkey.toBase58()}`);
  } else {
    validatorPubkey = new PublicKey(config.validator);
    console.log(`   Using configured validator: ${validatorPubkey.toBase58()}`);
  }
  console.log("");

  console.log("🔧 Calling initialize()...");
  try {
    const tx = await program.methods
      .initialize(validatorPubkey)
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol initialized!");
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);
  } catch (e) {
    console.log("❌ Initialization failed:", e.message);
    process.exit(1);
  }
  console.log("");

  // Step 2: Seed Prize
  console.log("═".repeat(70));
  console.log("STEP 2: Seed Prize Pool");
  console.log("═".repeat(70));
  console.log("");

  const prizeLamports = config.prizeSeedAmount * 1e9;
  console.log(`💰 Seeding ${config.prizeSeedAmount} SOL (${prizeLamports} lamports)...`);

  try {
    const tx = await program.methods
      .seedPrize(new anchor.BN(prizeLamports))
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Prize pool seeded!");
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);
  } catch (e) {
    console.log("⚠️  Prize seeding failed:", e.message);
    console.log("   You can seed prize later using the manage script");
  }
  console.log("");

  // Step 3: Initialize First Round
  console.log("═".repeat(70));
  console.log("STEP 3: Initialize Round #" + config.initialRoundId);
  console.log("═".repeat(70));
  console.log("");

  const roundId = config.initialRoundId;
  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))
    ],
    program.programId
  );

  const stakeAccount = Keypair.generate();
  const startEpoch = Date.now();

  console.log(`🎯 Initializing Round #${roundId}...`);
  console.log(`   Round PDA: ${roundPda.toBase58()}`);
  console.log(`   Start Epoch: ${startEpoch}`);
  console.log("");

  try {
    const tx = await program.methods
      .initRound(new anchor.BN(roundId), new anchor.BN(startEpoch))
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Round initialized!");
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);
  } catch (e) {
    console.log("⚠️  Round initialization failed:", e.message);
    console.log("   You can initialize rounds later using the manage script");
  }
  console.log("");

  // Final status check
  console.log("═".repeat(70));
  console.log("📊 FINAL STATE");
  console.log("═".repeat(70));
  console.log("");

  try {
    const finalProtocol = await program.account.protocolState.fetch(protocolPda);
    const finalRound = await program.account.roundState.fetch(roundPda);

    console.log("🌐 Protocol State:");
    console.log(`   PDA: ${protocolPda.toBase58()}`);
    console.log(`   Admin: ${finalProtocol.admin.toBase58()}`);
    console.log(`   Validator: ${finalProtocol.validator.toBase58()}`);
    console.log(`   Current Round: ${finalProtocol.currentRound.toString()}`);
    console.log(`   Prize Seed: ${(finalProtocol.prizeSeedAmount.toNumber() / 1e9).toFixed(3)} SOL`);
    console.log("");

    console.log("🎲 Round State:");
    console.log(`   PDA: ${roundPda.toBase58()}`);
    console.log(`   Round ID: ${finalRound.roundId.toString()}`);
    console.log(`   Epoch: ${finalRound.epochInRound}/3`);
    console.log(`   Stake Account: ${finalRound.stakeAccount.toBase58()}`);
    console.log("");

    // Save initialization info
    const initInfo = {
      environment,
      network: config.network,
      protocolPda: protocolPda.toBase58(),
      admin: finalProtocol.admin.toBase58(),
      validator: finalProtocol.validator.toBase58(),
      initialRound: roundId,
      roundPda: roundPda.toBase58(),
      prizeSeed: config.prizeSeedAmount,
      timestamp: new Date().toISOString(),
    };

    const initPath = path.join(__dirname, `../deployments/${environment}-init.json`);
    fs.writeFileSync(initPath, JSON.stringify(initInfo, null, 2));
    console.log("💾 Initialization info saved to:", initPath);
    console.log("");
  } catch (e) {
    console.log("⚠️  Could not fetch final state:", e.message);
  }

  console.log("═".repeat(70));
  console.log("✅ INITIALIZATION COMPLETE");
  console.log("═".repeat(70));
  console.log("");
  console.log("🎯 Next Steps:");
  console.log("   1. Users can now call deposit() to participate");
  console.log("   2. Use manage script to advance epochs");
  console.log("   3. Select winner after epoch 3");
  console.log("   4. Test the frontend at http://localhost:5174/");
  console.log("");
  console.log("📚 Useful Commands:");
  console.log(`   - Check state: solana account ${protocolPda.toBase58()} --url ${config.rpcUrl}`);
  console.log(`   - View in explorer: https://explorer.solana.com/address/${protocolPda.toBase58()}?cluster=${config.network}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  });
