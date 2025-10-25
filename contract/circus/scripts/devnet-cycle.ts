import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Rafa } from "../target/types/rafa";

/**
 * Devnet Circuit Test Script
 *
 * This script runs complete lottery cycles on devnet:
 * - WIN scenario: You are the only participant, guaranteed to win
 * - LOSE scenario: Multiple participants, you might lose
 *
 * Usage:
 *   ts-node scripts/devnet-cycle.ts win
 *   ts-node scripts/devnet-cycle.ts lose
 */

async function runWinScenario(
  program: Program<Rafa>,
  provider: anchor.AnchorProvider,
  protocolPda: PublicKey,
  roundId: number
) {
  console.log("\n🏆 ===== WIN SCENARIO =====");
  console.log("You'll be the ONLY participant - guaranteed to win!\n");

  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))
    ],
    program.programId
  );

  // Initialize round
  const stakeAccount = Keypair.generate();
  await program.methods
    .initRound(new anchor.BN(roundId), new anchor.BN(Date.now()))
    .accounts({
      admin: provider.wallet.publicKey,
      protocolState: protocolPda,
      stakeAccount: stakeAccount.publicKey,
      roundState: roundPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("✅ Round", roundId, "initialized");

  // Only your deposit
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const depositAmount = new anchor.BN(100_000_000); // 0.1 SOL
  await program.methods
    .deposit(depositAmount)
    .accounts({
      user: provider.wallet.publicKey,
      protocolState: protocolPda,
      userAccount: userPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("✅ You deposited 0.1 SOL (only participant)");

  // Run through 3 epochs
  for (let epoch = 1; epoch <= 3; epoch++) {
    console.log(`\n📸 Epoch ${epoch} - Taking snapshot...`);
    await program.methods
      .takeSnapshotBatch()
      .accounts({
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts([
        { pubkey: userPda, isSigner: false, isWritable: true },
      ])
      .rpc();
    console.log(`✅ Epoch ${epoch} snapshot complete`);

    if (epoch < 3) {
      await program.methods
        .advanceEpoch()
        .accounts({
          admin: provider.wallet.publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .rpc();
      console.log(`⏭️  Advanced to Epoch ${epoch + 1}`);
    }
  }

  // Select winner (you're the only one, so you win!)
  console.log("\n🎲 Selecting winner...");
  await program.methods
    .selectWinnerLocal(new anchor.BN(Date.now()))
    .accounts({
      admin: provider.wallet.publicKey,
      protocolState: protocolPda,
      roundState: roundPda,
    })
    .remainingAccounts([
      { pubkey: userPda, isSigner: false, isWritable: false },
    ])
    .rpc();

  const round = await program.account.roundState.fetch(roundPda);
  console.log("🎉 WINNER:", round.winner?.toBase58());
  console.log("💰 Prize Pool:", round.totalPool.toString(), "lamports");

  return { roundPda, userPda, isWinner: true };
}

async function runLoseScenario(
  program: Program<Rafa>,
  provider: anchor.AnchorProvider,
  protocolPda: PublicKey,
  roundId: number
) {
  console.log("\n😢 ===== LOSE SCENARIO =====");
  console.log("Multiple participants - you might lose!\n");

  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))
    ],
    program.programId
  );

  // Initialize round
  const stakeAccount = Keypair.generate();
  await program.methods
    .initRound(new anchor.BN(roundId), new anchor.BN(Date.now()))
    .accounts({
      admin: provider.wallet.publicKey,
      protocolState: protocolPda,
      stakeAccount: stakeAccount.publicKey,
      roundState: roundPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("✅ Round", roundId, "initialized");

  // Create multiple participants
  const participants = [];
  const [yourUserPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );
  participants.push({
    keypair: null,
    pda: yourUserPda,
    pubkey: provider.wallet.publicKey,
    amount: new anchor.BN(30_000_000) // 0.03 SOL (smaller stake)
  });

  // Create 3 other participants with larger stakes
  for (let i = 0; i < 3; i++) {
    const kp = Keypair.generate();

    // Airdrop to new participant
    try {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    } catch (e) {
      console.log(`⚠️  Airdrop ${i+1} failed, participant may not have funds`);
      continue;
    }

    const [userPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), kp.publicKey.toBuffer()],
      program.programId
    );

    participants.push({
      keypair: kp,
      pda: userPda,
      pubkey: kp.publicKey,
      amount: new anchor.BN(200_000_000) // 0.2 SOL each (much larger!)
    });
  }

  // All participants deposit
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    console.log(`💰 Participant ${i + 1} depositing ${p.amount.toNumber() / 1e9} SOL...`);

    const signers = p.keypair ? [p.keypair] : [];
    await program.methods
      .deposit(p.amount)
      .accounts({
        user: p.pubkey,
        protocolState: protocolPda,
        userAccount: p.pda,
        systemProgram: SystemProgram.programId,
      })
      .signers(signers)
      .rpc();
    console.log(`   ✅ Deposited (${i === 0 ? 'YOU' : 'Other player'})`);
  }

  // Run through 3 epochs with all participants
  const allUserPdas = participants.map(p => ({
    pubkey: p.pda,
    isSigner: false,
    isWritable: true
  }));

  for (let epoch = 1; epoch <= 3; epoch++) {
    console.log(`\n📸 Epoch ${epoch} - Taking snapshot for ${participants.length} participants...`);
    await program.methods
      .takeSnapshotBatch()
      .accounts({
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts(allUserPdas)
      .rpc();
    console.log(`✅ Epoch ${epoch} snapshot complete`);

    if (epoch < 3) {
      await program.methods
        .advanceEpoch()
        .accounts({
          admin: provider.wallet.publicKey,
          protocolState: protocolPda,
          roundState: roundPda,
        })
        .rpc();
      console.log(`⏭️  Advanced to Epoch ${epoch + 1}`);
    }
  }

  // Select winner
  console.log("\n🎲 Selecting winner...");
  await program.methods
    .selectWinnerLocal(new anchor.BN(Date.now()))
    .accounts({
      admin: provider.wallet.publicKey,
      protocolState: protocolPda,
      roundState: roundPda,
    })
    .remainingAccounts(allUserPdas.map(u => ({ ...u, isWritable: false })))
    .rpc();

  const round = await program.account.roundState.fetch(roundPda);
  const winner = round.winner?.toBase58();
  const isWinner = winner === provider.wallet.publicKey.toBase58();

  console.log("\n🏆 WINNER:", winner);
  console.log("💰 Prize Pool:", round.totalPool.toString(), "lamports");

  if (isWinner) {
    console.log("🎉 YOU WON! (lucky!)");
  } else {
    console.log("😢 You lost... (expected with small stake)");
  }

  return { roundPda, userPda: yourUserPda, isWinner };
}

async function main() {
  const scenario = process.argv[2]?.toLowerCase() || 'win';

  if (!['win', 'lose'].includes(scenario)) {
    console.log("❌ Invalid scenario. Use: win or lose");
    console.log("   Example: ts-node scripts/devnet-cycle.ts win");
    process.exit(1);
  }

  console.log("🎮 Starting Devnet Lottery Circuit Test");
  console.log("📡 Scenario:", scenario.toUpperCase());
  console.log("");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Rafa as Program<Rafa>;

  console.log("🔗 RPC:", provider.connection.rpcEndpoint);
  console.log("🔑 Your Wallet:", provider.wallet.publicKey.toBase58());
  console.log("💻 Program ID:", program.programId.toBase58());

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  // Check/initialize protocol
  console.log("\n🔧 Checking protocol state...");
  let protocolState;
  let needsInit = false;
  try {
    protocolState = await program.account.protocolState.fetch(protocolPda);
    console.log("✅ Protocol initialized (Round:", protocolState.currentRound.toString() + ")");
  } catch (e) {
    needsInit = true;
    console.log("⚠️  Initializing protocol...");
  }

  if (needsInit) {
    const validator = Keypair.generate().publicKey;
    await program.methods
      .initialize(validator)
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Protocol initialized");

    // Seed prize
    await program.methods
      .seedPrize(new anchor.BN(100_000_000)) // 0.1 SOL
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Prize pool seeded with 0.1 SOL");
  }

  // Get next round ID
  protocolState = await program.account.protocolState.fetch(protocolPda);
  const nextRoundId = protocolState.currentRound.toNumber() + 1;

  // Run scenario
  let result;
  if (scenario === 'win') {
    result = await runWinScenario(program, provider, protocolPda, nextRoundId);
  } else {
    result = await runLoseScenario(program, provider, protocolPda, nextRoundId);
  }

  // Display final state
  console.log("\n" + "=".repeat(70));
  console.log("📊 FINAL STATE - Ready for Frontend Testing");
  console.log("=".repeat(70));

  const finalProtocol = await program.account.protocolState.fetch(protocolPda);
  const finalRound = await program.account.roundState.fetch(result.roundPda);
  const finalUser = await program.account.userAccount.fetch(result.userPda);

  console.log("\n🌐 Protocol State:");
  console.log("   PDA:", protocolPda.toBase58());
  console.log("   Current Round:", finalProtocol.currentRound.toString());
  console.log("   Prize Seed Amount:", (finalProtocol.prizeSeedAmount.toNumber() / 1e9).toFixed(3), "SOL");

  console.log("\n🎲 Round State (Round #" + nextRoundId + "):");
  console.log("   PDA:", result.roundPda.toBase58());
  console.log("   Total Pool:", (finalRound.totalPool.toNumber() / 1e9).toFixed(3), "SOL");
  console.log("   Winner:", finalRound.winner?.toBase58());
  console.log("   Result:", result.isWinner ? "🎉 YOU WON!" : "😢 You Lost");

  console.log("\n👤 Your User Account:");
  console.log("   PDA:", result.userPda.toBase58());
  console.log("   Balance:", (finalUser.balance.toNumber() / 1e9).toFixed(3), "SOL");
  console.log("   Snapshots: [" +
    finalUser.snapshotBalances.map((b: anchor.BN) => (b.toNumber() / 1e9).toFixed(3)).join(", ") +
    "] SOL");

  console.log("\n" + "=".repeat(70));
  console.log("✅ Test Complete! Open frontend to see the result.");
  console.log("=".repeat(70));
  console.log("\n💡 URLs:");
  console.log("   App: http://localhost:5174/");
  console.log("   Explorer: https://explorer.solana.com/address/" + protocolPda.toBase58() + "?cluster=devnet");
  console.log("\n🎮 Make sure your wallet is set to DEVNET!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
