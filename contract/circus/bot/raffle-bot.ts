/**
 * 🤖 AUTOMATED RAFFLE BOT
 *
 * This bot runs 24/7 and automatically:
 * - Advances epochs every 2 minutes
 * - Takes snapshots when Epoch 3 ends
 * - Selects winners
 * - Starts new rounds
 *
 * NO HUMAN INTERVENTION NEEDED!
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rafa } from "../target/types/rafa";

// Configuration
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const EPOCH_DURATION_MS = 120000; // 2 minutes per epoch

class RaffleBot {
  private program: Program<Rafa>;
  private provider: anchor.AnchorProvider;
  private protocolPda: PublicKey;
  private isProcessing: boolean = false;

  constructor() {
    this.provider = anchor.AnchorProvider.env();
    anchor.setProvider(this.provider);
    this.program = anchor.workspace.Rafa as Program<Rafa>;

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      this.program.programId
    );
    this.protocolPda = pda;
  }

  /**
   * Main loop - runs forever
   */
  async start() {
    console.log("🤖 Raffle Bot Started!");
    console.log("📡 Admin Wallet:", this.provider.wallet.publicKey.toString());
    console.log("🔄 Checking every", CHECK_INTERVAL_MS / 1000, "seconds\n");

    // Run initial check
    await this.checkAndAct();

    // Set up interval
    setInterval(async () => {
      await this.checkAndAct();
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Check blockchain state and take action if needed
   */
  private async checkAndAct() {
    if (this.isProcessing) {
      console.log("⏳ Already processing, skipping this cycle...");
      return;
    }

    try {
      this.isProcessing = true;

      // Get protocol state
      const protocolState = await this.program.account.protocolState.fetch(this.protocolPda);
      const currentRound = protocolState.currentRound.toNumber();

      if (currentRound === 0) {
        console.log("⚠️ No round initialized. Please initialize Round #1 manually first.");
        return;
      }

      // Get round state
      const [roundPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("round"),
          this.protocolPda.toBuffer(),
          Buffer.from(new anchor.BN(currentRound).toArrayLike(Buffer, "le", 8)),
        ],
        this.program.programId
      );

      const roundState = await this.program.account.roundState.fetch(roundPda);

      // Log current state
      const now = Date.now();
      const startEpoch = Number(roundState.startEpoch.toString());
      const currentEpoch = roundState.epochInRound;
      const isComplete = roundState.isComplete;

      console.log("\n" + "=".repeat(60));
      console.log(`⏰ ${new Date().toLocaleTimeString()}`);
      console.log(`🎲 Round #${currentRound} | Epoch ${currentEpoch}/3 | Complete: ${isComplete}`);

      // If round is complete, start a new one
      if (isComplete) {
        console.log("✅ Round complete! Starting new round...");
        await this.initializeNewRound(currentRound + 1);
        return;
      }

      // Calculate time since epoch started
      const epochStartTime = startEpoch + ((currentEpoch - 1) * EPOCH_DURATION_MS);
      const timeSinceEpochStart = now - epochStartTime;
      const timeRemaining = EPOCH_DURATION_MS - timeSinceEpochStart;

      if (currentEpoch < 3) {
        // We're in Epoch 1 or 2
        if (timeRemaining <= 0) {
          console.log(`⏰ Epoch ${currentEpoch} expired! Advancing to Epoch ${currentEpoch + 1}...`);
          await this.advanceEpoch(roundPda);
        } else {
          console.log(`⏳ Epoch ${currentEpoch} - ${Math.floor(timeRemaining / 1000)}s remaining`);
        }
      } else if (currentEpoch === 3) {
        // We're in Epoch 3
        if (timeRemaining <= 0) {
          console.log("🎰 Epoch 3 expired! Taking snapshot and selecting winner...");

          // Take snapshot first
          await this.takeSnapshot(roundPda, currentRound);

          // Then select winner
          await this.selectWinner(roundPda, currentRound);
        } else {
          console.log(`⏳ Epoch 3 (FINAL) - ${Math.floor(timeRemaining / 1000)}s remaining`);
        }
      }

    } catch (error: any) {
      console.error("❌ Error:", error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Advance to next epoch
   */
  private async advanceEpoch(roundPda: PublicKey) {
    try {
      const tx = await this.program.methods
        .advanceEpoch()
        .accountsPartial({
          admin: this.provider.wallet.publicKey,
          protocolState: this.protocolPda,
          roundState: roundPda,
        })
        .rpc();

      console.log("✅ Epoch advanced! TX:", tx);
      console.log("🔗 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (error: any) {
      console.error("❌ Failed to advance epoch:", error.message);
    }
  }

  /**
   * Take snapshot of all participants
   */
  private async takeSnapshot(roundPda: PublicKey, currentRound: number) {
    try {
      // Get all user accounts that participated in this round
      const allAccounts = await this.program.account.userAccount.all();
      const participatingAccounts = allAccounts
        .filter((acc) => acc.account.roundJoined.toNumber() === currentRound)
        .map((acc) => acc.publicKey);

      console.log(`📸 Taking snapshot for ${participatingAccounts.length} participants...`);

      const tx = await this.program.methods
        .takeSnapshotBatch()
        .accountsPartial({
          protocolState: this.protocolPda,
          roundState: roundPda,
        })
        .remainingAccounts(
          participatingAccounts.map((pk) => ({
            pubkey: pk,
            isWritable: true,
            isSigner: false,
          }))
        )
        .rpc();

      console.log("✅ Snapshot taken! TX:", tx);
    } catch (error: any) {
      console.error("❌ Failed to take snapshot:", error.message);
      throw error; // Don't select winner if snapshot fails
    }
  }

  /**
   * Select winner for the round
   */
  private async selectWinner(roundPda: PublicKey, currentRound: number) {
    try {
      // Get all user accounts that participated in this round
      const allAccounts = await this.program.account.userAccount.all();
      const participatingAccounts = allAccounts
        .filter((acc) => acc.account.roundJoined.toNumber() === currentRound)
        .map((acc) => acc.publicKey);

      console.log(`🎲 Selecting winner from ${participatingAccounts.length} participants...`);

      // Generate random seed
      const seed = new anchor.BN(Date.now());

      const tx = await this.program.methods
        .selectWinnerLocal(seed)
        .accountsPartial({
          admin: this.provider.wallet.publicKey,
          protocolState: this.protocolPda,
          roundState: roundPda,
        })
        .remainingAccounts(
          participatingAccounts.map((pk) => ({
            pubkey: pk,
            isWritable: true,
            isSigner: false,
          }))
        )
        .rpc();

      console.log("✅ Winner selected! TX:", tx);

      // Get winner address
      const roundState = await this.program.account.roundState.fetch(roundPda);
      if (roundState.winner) {
        console.log("🏆 Winner:", roundState.winner.toString());
      }
    } catch (error: any) {
      console.error("❌ Failed to select winner:", error.message);
    }
  }

  /**
   * Initialize a new round
   */
  private async initializeNewRound(roundId: number) {
    try {
      const [roundPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("round"),
          this.protocolPda.toBuffer(),
          Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8)),
        ],
        this.program.programId
      );

      const stakeAccount = anchor.web3.Keypair.generate();
      const startEpoch = Date.now();

      const tx = await this.program.methods
        .initRound(new anchor.BN(roundId), new anchor.BN(startEpoch))
        .accountsPartial({
          admin: this.provider.wallet.publicKey,
          stakeAccount: stakeAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Round #${roundId} initialized! TX:`, tx);
      console.log("🔗 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (error: any) {
      console.error("❌ Failed to initialize round:", error.message);
    }
  }
}

// Start the bot
const bot = new RaffleBot();
bot.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n👋 Bot stopped by user");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n👋 Bot stopped");
  process.exit(0);
});
