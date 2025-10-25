/**
 * Unified Deployment Script
 *
 * Handles deployment to devnet, mainnet, or localnet
 * Usage: node scripts/deploy.js <environment>
 * Example: node scripts/deploy.js devnet
 */

const anchor = require("@coral-xyz/anchor");
const { Keypair, PublicKey } = require("@solana/web3.js");
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
  console.log(`🚀 DEPLOYMENT SCRIPT - ${environment.toUpperCase()}`);
  console.log("═".repeat(70));
  console.log("");

  // Load configuration
  const config = loadConfig(environment);
  console.log("📋 Configuration:");
  console.log(`   Network: ${config.network}`);
  console.log(`   RPC: ${config.rpcUrl}`);
  console.log(`   Program ID: ${config.programId}`);
  console.log(`   Test Mode: ${config.testMode}`);
  console.log("");

  // Set Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("🔑 Deployment Wallet:", provider.wallet.publicKey.toBase58());

  // Check balance
  const balance = await provider.connection.getBalance(provider.wallet.publicKey);
  console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 3e9) {
    console.log("⚠️  WARNING: Low balance! You need at least 3 SOL for deployment.");
    if (!config.testMode) {
      console.log("❌ Aborting mainnet deployment with insufficient funds.");
      process.exit(1);
    }
  }
  console.log("");

  // Build the program
  console.log("🔨 Building program...");
  const { execSync } = require("child_process");
  try {
    execSync("anchor build", { stdio: "inherit" });
    console.log("✅ Build successful");
  } catch (e) {
    console.log("❌ Build failed");
    process.exit(1);
  }
  console.log("");

  // Verify program ID matches
  const programKeypair = path.join(__dirname, "../target/deploy/rafa-keypair.json");
  const programKey = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(programKeypair, "utf8")))
  ).publicKey;

  console.log("🔍 Verifying Program ID...");
  console.log(`   Keypair:     ${programKey.toBase58()}`);
  console.log(`   Config:      ${config.programId}`);

  if (programKey.toBase58() !== config.programId) {
    console.log("⚠️  Program ID mismatch!");
    console.log("   Update config/environments.json or regenerate keypair");

    if (!config.testMode) {
      console.log("❌ Aborting mainnet deployment with mismatched Program ID");
      process.exit(1);
    }
  } else {
    console.log("✅ Program ID matches");
  }
  console.log("");

  // Deploy
  console.log("📡 Deploying to", config.network, "...");
  try {
    execSync(`anchor deploy --provider.cluster ${config.network}`, { stdio: "inherit" });
    console.log("✅ Deployment successful!");
  } catch (e) {
    console.log("❌ Deployment failed");
    process.exit(1);
  }
  console.log("");

  // Copy IDL to frontend
  console.log("📄 Copying IDL to frontend...");
  const idlSource = path.join(__dirname, "../target/idl/rafa.json");
  const idlDest = path.join(__dirname, "../../../src/idl/rafa.json");

  try {
    fs.mkdirSync(path.dirname(idlDest), { recursive: true });
    fs.copyFileSync(idlSource, idlDest);
    console.log("✅ IDL copied to:", idlDest);
  } catch (e) {
    console.log("⚠️  IDL copy failed:", e.message);
  }
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    environment,
    network: config.network,
    programId: programKey.toBase58(),
    deployer: provider.wallet.publicKey.toBase58(),
    timestamp: new Date().toISOString(),
    balance: balance / 1e9,
  };

  const deploymentPath = path.join(__dirname, `../deployments/${environment}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);
  console.log("");

  // Summary
  console.log("═".repeat(70));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("═".repeat(70));
  console.log("");
  console.log("📊 Summary:");
  console.log(`   Program ID: ${programKey.toBase58()}`);
  console.log(`   Network: ${config.network}`);
  console.log(`   Explorer: https://explorer.solana.com/address/${programKey.toBase58()}?cluster=${config.network}`);
  console.log("");
  console.log("🎯 Next Steps:");
  console.log(`   1. Run: node scripts/initialize.js ${environment}`);
  console.log("   2. Test the protocol");
  console.log("   3. Initialize rounds and start accepting deposits");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
