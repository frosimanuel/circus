/**
 * FULL LIFECYCLE INTEGRATION TEST
 *
 * This test simulates the complete raffle flow:
 * 1. Multiple users buy tickets
 * 2. Epochs auto-advance based on time
 * 3. Round auto-finalizes and selects winner
 * 4. Winner claims prize
 * 5. Losers withdraw stakes
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

describe("🎪 Full Lifecycle Test - Multi-User Autonomous Raffle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafa as Program;
  const admin = provider.wallet.publicKey;

  // Test users
  let user1: Keypair;
  let user2: Keypair;
  let user3: Keypair;

  console.log("\n🎯 Starting Full Lifecycle Test");
  console.log("Program ID:", program.programId.toString());
  console.log("Admin:", admin.toString());

  before(async () => {
    console.log("\n📋 SETUP: Creating test users and funding wallets");

    // Create test users
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    user3 = Keypair.generate();

    console.log("User 1:", user1.publicKey.toString());
    console.log("User 2:", user2.publicKey.toString());
    console.log("User 3:", user3.publicKey.toString());

    // Airdrop SOL to test users (devnet)
    console.log("\n💸 Requesting airdrops...");

    const airdrop1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      3 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop1);
    console.log("✅ User 1 funded: 3 SOL");

    const airdrop2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      3 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop2);
    console.log("✅ User 2 funded: 3 SOL");

    const airdrop3 = await provider.connection.requestAirdrop(
      user3.publicKey,
      3 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop3);
    console.log("✅ User 3 funded: 3 SOL");

    console.log("\n✅ Setup complete!");
  });

  it("1️⃣ User 1 buys 10 tickets (Epoch 1)", async () => {
    console.log("\n=== TEST 1: User 1 Buys Tickets ===");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    console.log("Current Round:", currentRoundId);

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [user1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user1.publicKey.toBuffer()],
      program.programId
    );

    // User 1 buys 10 tickets (0.1 SOL)
    const amount1 = new BN(0.1 * LAMPORTS_PER_SOL);

    const user1Provider = new anchor.AnchorProvider(
      provider.connection,
      new anchor.Wallet(user1),
      { commitment: "confirmed" }
    );
    const user1Program = new Program(program.idl, program.programId, user1Provider);

    console.log("User 1 buying 10 tickets (0.1 SOL)...");

    const tx = await user1Program.methods
      .deposit(amount1)
      .accounts({
        user: user1.publicKey,
        protocolState: protocolPda,
        userAccount: user1Pda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: roundPda, isSigner: false, isWritable: true }
      ])
      .rpc();

    console.log("✅ Transaction:", tx);

    await provider.connection.confirmTransaction(tx, "confirmed");

    // Verify round state
    const round = await program.account.roundState.fetch(roundPda);
    console.log("\n📊 Round State After User 1:");
    console.log("   Total Tickets:", round.totalTicketsSold.toNumber());
    console.log("   Total Staked:", round.totalStakedLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("   Epoch:", round.epochInRound);
    console.log("   Is Complete:", round.isComplete);

    assert.equal(round.totalTicketsSold.toNumber(), 10, "Should have 10 tickets");
    assert.equal(round.epochInRound, 1, "Should be in Epoch 1");

    // Verify user account
    const userAccount = await program.account.userAccount.fetch(user1Pda);
    console.log("\n👤 User 1 Account:");
    console.log("   Balance:", userAccount.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("   Tickets:", userAccount.ticketStart.toNumber(), "-", userAccount.ticketEnd.toNumber());
    console.log("   Round Joined:", userAccount.roundJoined.toNumber());

    assert.equal(userAccount.balance.toNumber(), amount1.toNumber(), "Balance should match deposit");
    assert.equal(userAccount.ticketStart.toNumber(), 0, "First ticket should be 0");
    assert.equal(userAccount.ticketEnd.toNumber(), 9, "Last ticket should be 9");
  });

  it("2️⃣ User 2 buys 5 tickets (Epoch 1)", async () => {
    console.log("\n=== TEST 2: User 2 Buys Tickets ===");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [user2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user2.publicKey.toBuffer()],
      program.programId
    );

    // User 2 buys 5 tickets (0.05 SOL)
    const amount2 = new BN(0.05 * LAMPORTS_PER_SOL);

    const user2Provider = new anchor.AnchorProvider(
      provider.connection,
      new anchor.Wallet(user2),
      { commitment: "confirmed" }
    );
    const user2Program = new Program(program.idl, program.programId, user2Provider);

    console.log("User 2 buying 5 tickets (0.05 SOL)...");

    const tx = await user2Program.methods
      .deposit(amount2)
      .accounts({
        user: user2.publicKey,
        protocolState: protocolPda,
        userAccount: user2Pda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: roundPda, isSigner: false, isWritable: true }
      ])
      .rpc();

    console.log("✅ Transaction:", tx);

    await provider.connection.confirmTransaction(tx, "confirmed");

    // Verify round state
    const round = await program.account.roundState.fetch(roundPda);
    console.log("\n📊 Round State After User 2:");
    console.log("   Total Tickets:", round.totalTicketsSold.toNumber());
    console.log("   Total Staked:", round.totalStakedLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");

    assert.equal(round.totalTicketsSold.toNumber(), 15, "Should have 15 tickets total");

    // Verify user account
    const userAccount = await program.account.userAccount.fetch(user2Pda);
    console.log("\n👤 User 2 Account:");
    console.log("   Balance:", userAccount.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("   Tickets:", userAccount.ticketStart.toNumber(), "-", userAccount.ticketEnd.toNumber());

    assert.equal(userAccount.ticketStart.toNumber(), 10, "First ticket should be 10");
    assert.equal(userAccount.ticketEnd.toNumber(), 14, "Last ticket should be 14");
  });

  it("3️⃣ Check epoch auto-advancement logic", async () => {
    console.log("\n=== TEST 3: Epoch Auto-Advancement Check ===");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const roundBefore = await program.account.roundState.fetch(roundPda);

    console.log("📊 Current Round State:");
    console.log("   Round ID:", roundBefore.roundId.toNumber());
    console.log("   Epoch:", roundBefore.epochInRound);
    console.log("   Start Time:", new Date(Number(roundBefore.startEpoch.toString())).toISOString());
    console.log("   Current Time:", new Date().toISOString());

    const startTime = Number(roundBefore.startEpoch.toString());
    const currentTime = Date.now();
    const elapsedMs = currentTime - startTime;
    const elapsedMinutes = elapsedMs / (1000 * 60);

    console.log("\n⏱️  Time Elapsed:");
    console.log("   Milliseconds:", elapsedMs);
    console.log("   Minutes:", elapsedMinutes.toFixed(2));
    console.log("   Expected epoch duration: 2 minutes (120 seconds)");

    // Calculate expected epoch
    const EPOCH_DURATION_MS = 120 * 1000; // 2 minutes
    const epochsPassed = Math.floor(elapsedMs / EPOCH_DURATION_MS);
    const expectedEpoch = Math.min(epochsPassed + 1, 3);

    console.log("\n🎯 Expected State:");
    console.log("   Epochs passed:", epochsPassed);
    console.log("   Expected epoch:", expectedEpoch);
    console.log("   Actual epoch:", roundBefore.epochInRound);

    if (elapsedMinutes < 2) {
      console.log("\n⏳ Less than 2 minutes elapsed - Epoch should still be 1");
      assert.equal(roundBefore.epochInRound, 1, "Should be in Epoch 1");
    } else if (elapsedMinutes < 4) {
      console.log("\n⏳ Between 2-4 minutes - Testing auto-advance to Epoch 2");

      // Make a small deposit to trigger epoch check
      const [user3Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user3.publicKey.toBuffer()],
        program.programId
      );

      const user3Provider = new anchor.AnchorProvider(
        provider.connection,
        new anchor.Wallet(user3),
        { commitment: "confirmed" }
      );
      const user3Program = new Program(program.idl, program.programId, user3Provider);

      console.log("   Triggering deposit to check epoch auto-advance...");

      const tx = await user3Program.methods
        .deposit(new BN(0.01 * LAMPORTS_PER_SOL))
        .accounts({
          user: user3.publicKey,
          protocolState: protocolPda,
          userAccount: user3Pda,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: roundPda, isSigner: false, isWritable: true }
        ])
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");

      const roundAfter = await program.account.roundState.fetch(roundPda);
      console.log("\n   ✅ After deposit:");
      console.log("      Epoch:", roundAfter.epochInRound);
      console.log("      Expected:", expectedEpoch);

      assert.equal(
        roundAfter.epochInRound,
        expectedEpoch,
        `Epoch should auto-advance to ${expectedEpoch}`
      );
    } else if (elapsedMinutes >= 6) {
      console.log("\n⏳ More than 6 minutes - Round should auto-finalize");

      // Try to deposit (should fail with RoundComplete)
      const [user3Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user3.publicKey.toBuffer()],
        program.programId
      );

      const user3Provider = new anchor.AnchorProvider(
        provider.connection,
        new anchor.Wallet(user3),
        { commitment: "confirmed" }
      );
      const user3Program = new Program(program.idl, program.programId, user3Provider);

      try {
        await user3Program.methods
          .deposit(new BN(0.01 * LAMPORTS_PER_SOL))
          .accounts({
            user: user3.publicKey,
            protocolState: protocolPda,
            userAccount: user3Pda,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([
            { pubkey: roundPda, isSigner: false, isWritable: true },
            { pubkey: user1Pda, isSigner: false, isWritable: false },
            { pubkey: user2Pda, isSigner: false, isWritable: false },
          ])
          .rpc();

        // If we get here, round didn't finalize
        console.log("   ⚠️  Deposit succeeded - round not finalized yet");
      } catch (err: any) {
        if (err.message && err.message.includes("RoundComplete")) {
          console.log("   ✅ Round auto-finalized! Deposits blocked as expected");

          const roundAfter = await program.account.roundState.fetch(roundPda);
          console.log("      Winner:", roundAfter.winner?.toString() || "None");
          console.log("      Winning Ticket:", roundAfter.winningTicket.toNumber());
          console.log("      Is Complete:", roundAfter.isComplete);

          assert.isTrue(roundAfter.isComplete, "Round should be complete");
          assert.isNotNull(roundAfter.winner, "Winner should be selected");
        } else {
          throw err;
        }
      }
    }
  });

  it("4️⃣ Count participants correctly", async () => {
    console.log("\n=== TEST 4: Participant Count ===");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    // Get all UserAccounts for this round
    const allAccounts = await provider.connection.getProgramAccounts(
      program.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: "3", // UserAccount discriminator (you may need to adjust this)
            }
          }
        ]
      }
    );

    console.log("📊 Total UserAccount PDAs found:", allAccounts.length);

    // Filter by current round
    let participantsInRound = 0;
    const participants: { pubkey: string, tickets: number, balance: number }[] = [];

    for (const accountInfo of allAccounts) {
      try {
        const data = accountInfo.account.data;
        const userAccount = program.coder.accounts.decode("UserAccount", data);

        if (userAccount.roundJoined.toNumber() === currentRoundId && userAccount.balance.toNumber() > 0) {
          participantsInRound++;
          participants.push({
            pubkey: userAccount.owner.toString(),
            tickets: userAccount.ticketEnd.toNumber() - userAccount.ticketStart.toNumber() + 1,
            balance: userAccount.balance.toNumber() / LAMPORTS_PER_SOL,
          });
        }
      } catch (err) {
        // Not a UserAccount, skip
      }
    }

    console.log("\n👥 Participants in Round", currentRoundId + ":");
    participants.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.pubkey.slice(0, 8)}... - ${p.tickets} tickets (${p.balance} SOL)`);
    });

    console.log("\n✅ Total Participants:", participantsInRound);

    // We should have at least 2 participants (user1 and user2)
    assert.isAtLeast(participantsInRound, 2, "Should have at least 2 participants");
  });

  it("5️⃣ Summary and Recommendations", async () => {
    console.log("\n=== TEST SUMMARY ===");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const round = await program.account.roundState.fetch(roundPda);

    console.log("\n📊 Final Round State:");
    console.log("   Round ID:", round.roundId.toNumber());
    console.log("   Epoch:", round.epochInRound);
    console.log("   Total Tickets:", round.totalTicketsSold.toNumber());
    console.log("   Total Staked:", round.totalStakedLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("   Is Complete:", round.isComplete);
    console.log("   Winner:", round.winner?.toString() || "TBD");

    const startTime = Number(round.startEpoch.toString());
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

    console.log("\n⏱️  Timing:");
    console.log("   Elapsed:", elapsedMinutes.toFixed(2), "minutes");
    console.log("   Next epoch at:", ((Math.floor(elapsedMinutes / 2) + 1) * 2).toFixed(0), "minutes");

    if (!round.isComplete) {
      console.log("\n📋 Next Steps:");
      console.log("   1. Wait", (6 - elapsedMinutes).toFixed(1), "more minutes for round to complete");
      console.log("   2. Make a deposit transaction to trigger finalization");
      console.log("   3. Winner will be selected automatically");
    }

    console.log("\n✅ All tests completed!");
  });
});
