/**
 * Protocol Management Script
 *
 * Manage rounds, epochs, and testing
 * Usage: node scripts/manage.js <environment> <action> [params]
 * Example: node scripts/manage.js devnet advance-epoch
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

async function getProtocolState(program) {
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  const state = await program.account.protocolState.fetch(protocolPda);
  return { pda: protocolPda, state };
}

async function getRoundState(program, protocolPda, roundId) {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))
    ],
    program.programId
  );
  const state = await program.account.roundState.fetch(roundPda);
  return { pda: roundPda, state };
}

async function displayStatus(program, config) {
  console.log("═".repeat(70));
  console.log("📊 PROTOCOL STATUS");
  console.log("═".repeat(70));
  console.log("");

  try {
    const { pda: protocolPda, state: protocol } = await getProtocolState(program);

    console.log("🌐 Protocol:");
    console.log(`   PDA: ${protocolPda.toBase58()}`);
    console.log(`   Admin: ${protocol.admin.toBase58()}`);
    console.log(`   Current Round: ${protocol.currentRound.toString()}`);
    console.log(`   Prize Seed: ${(protocol.prizeSeedAmount.toNumber() / 1e9).toFixed(3)} SOL`);
    console.log("");

    if (protocol.currentRound > 0) {
      const { pda: roundPda, state: round } = await getRoundState(
        program,
        protocolPda,
        protocol.currentRound
      );

      console.log("🎲 Current Round:");
      console.log(`   PDA: ${roundPda.toBase58()}`);
      console.log(`   Round ID: ${round.roundId.toString()}`);
      console.log(`   Epoch: ${round.epochInRound}/3`);
      console.log(`   Winner: ${round.winner ? round.winner.toBase58() : "Not selected"}`);
      console.log(`   Complete: ${round.isComplete}`);
    }

    console.log("");
    console.log(`🔗 Explorer: https://explorer.solana.com/address/${protocolPda.toBase58()}?cluster=${config.network}`);
  } catch (e) {
    console.log("❌ Error fetching status:", e.message);
  }
}

async function advanceEpoch(program, provider, config) {
  console.log("⏭️  Advancing Epoch...\n");

  const { pda: protocolPda, state: protocol } = await getProtocolState(program);
  const { pda: roundPda, state: round } = await getRoundState(
    program,
    protocolPda,
    protocol.currentRound
  );

  console.log(`Current epoch: ${round.epochInRound}/3`);

  if (round.epochInRound >= 3) {
    console.log("⚠️  Already at epoch 3. Select winner or start new round.");
    return;
  }

  try {
    const tx = await program.methods
      .advanceEpoch()
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .rpc();

    console.log(`✅ Advanced to epoch ${round.epochInRound + 1}`);
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);
  } catch (e) {
    console.log("❌ Failed:", e.message);
  }
}

async function selectWinner(program, provider, config) {
  console.log("🎲 Selecting Winner...\n");

  const { pda: protocolPda, state: protocol } = await getProtocolState(program);
  const { pda: roundPda } = await getRoundState(
    program,
    protocolPda,
    protocol.currentRound
  );

  const seed = Date.now();
  console.log(`Using seed: ${seed}`);

  try {
    const tx = await program.methods
      .selectWinnerLocal(new anchor.BN(seed))
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts([])  // In production, pass all user PDAs
      .rpc();

    console.log("✅ Winner selected!");
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);

    // Fetch and display winner
    const { state: updatedRound } = await getRoundState(
      program,
      protocolPda,
      protocol.currentRound
    );
    if (updatedRound.winner) {
      console.log(`   🏆 Winner: ${updatedRound.winner.toBase58()}`);
    }
  } catch (e) {
    console.log("❌ Failed:", e.message);
    console.log("   Note: Make sure users have deposited and snapshots are taken");
  }
}

async function initNewRound(program, provider, config, roundId) {
  console.log(`🎯 Initializing Round #${roundId}...\n`);

  const { pda: protocolPda } = await getProtocolState(program);
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
    console.log(`   Round PDA: ${roundPda.toBase58()}`);
    console.log(`   TX: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${config.network}`);
  } catch (e) {
    console.log("❌ Failed:", e.message);
  }
}

async function main() {
  const environment = process.argv[2] || "devnet";
  const action = process.argv[3];

  if (!action) {
    console.log("Usage: node manage.js <environment> <action> [params]");
    console.log("");
    console.log("Actions:");
    console.log("  status              - Show protocol status");
    console.log("  advance-epoch       - Move to next epoch");
    console.log("  select-winner       - Select winner for current round");
    console.log("  init-round <id>     - Initialize new round");
    console.log("");
    console.log("Example: node manage.js devnet status");
    process.exit(0);
  }

  const config = loadConfig(environment);
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Rafa;

  console.log(`🔧 Managing ${environment.toUpperCase()} Protocol\n`);

  switch (action) {
    case "status":
      await displayStatus(program, config);
      break;

    case "advance-epoch":
      await advanceEpoch(program, provider, config);
      await displayStatus(program, config);
      break;

    case "select-winner":
      await selectWinner(program, provider, config);
      await displayStatus(program, config);
      break;

    case "init-round":
      const roundId = parseInt(process.argv[4]);
      if (!roundId) {
        console.log("❌ Please provide round ID: node manage.js devnet init-round <id>");
        process.exit(1);
      }
      await initNewRound(program, provider, config, roundId);
      await displayStatus(program, config);
      break;

    default:
      console.log(`❌ Unknown action: ${action}`);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
