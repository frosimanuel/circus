/**
 * ACCOUNT STRUCTURE INTEGRATION TESTS
 *
 * Purpose: Catch buffer length errors, size mismatches, and serialization issues
 * Run BEFORE deploying to catch structural bugs early
 *
 * Tests:
 * - ProtocolState size validation
 * - RoundState size validation
 * - UserAccount size validation
 * - ClaimTicket size validation
 * - Buffer length error detection
 * - Serialization/deserialization
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";

describe("🔍 Account Structure Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafa as Program;
  const admin = provider.wallet.publicKey;

  console.log("\n🎯 Testing Account Structures");
  console.log("Program ID:", program.programId.toString());
  console.log("Admin:", admin.toString());

  it("1️⃣ ProtocolState has correct size", async () => {
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    // Expected size from contract: discriminator (8) + SIZE (97)
    const EXPECTED_DISCRIMINATOR = 8;
    const EXPECTED_STRUCT_SIZE = 97;  // From ProtocolState::SIZE
    const EXPECTED_TOTAL_SIZE = EXPECTED_DISCRIMINATOR + EXPECTED_STRUCT_SIZE;

    console.log("\n  📊 ProtocolState Size Check:");
    console.log("    Expected total:", EXPECTED_TOTAL_SIZE, "bytes");
    console.log("    Breakdown: 8 (discriminator) + 97 (struct)");
    console.log("    Struct: 32 (admin) + 32 (validator) + 8 (current_round) + 8 (prize_seed) + 8 (unclaimed) + 1 (bump)");

    try {
      const accountInfo = await provider.connection.getAccountInfo(protocolPda);

      if (!accountInfo) {
        console.log("    ⚠️  Account not initialized yet");
        return;
      }

      const actualSize = accountInfo.data.length;
      console.log("    Actual size:", actualSize, "bytes");

      // THIS IS THE KEY TEST that catches buffer length errors!
      if (actualSize !== EXPECTED_TOTAL_SIZE) {
        console.error("    ❌ SIZE MISMATCH DETECTED!");
        console.error(`       Expected: ${EXPECTED_TOTAL_SIZE} bytes`);
        console.error(`       Got: ${actualSize} bytes`);
        console.error(`       Difference: ${actualSize - EXPECTED_TOTAL_SIZE} bytes`);
        console.error("\n    🚨 This WILL cause 'buffer length' errors in transactions!");
        console.error("    📋 Fix: Close and reinitialize ProtocolState");

        throw new Error(
          `ProtocolState size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}. ` +
          `This will cause buffer length errors!`
        );
      }

      console.log("    ✅ Size is correct!");

      // Try to deserialize
      try {
        const protocol = await program.account.protocolState.fetch(protocolPda);
        console.log("    ✅ Deserialization successful");
        console.log("       Admin:", protocol.admin.toString());
        console.log("       Current Round:", protocol.currentRound.toNumber());
        console.log("       Total Unclaimed:", protocol.totalUnclaimedPrizes.toNumber());
      } catch (err: any) {
        console.error("    ❌ Deserialization failed:", err.message);
        throw new Error(`Failed to deserialize ProtocolState: ${err.message}`);
      }

      assert.equal(
        actualSize,
        EXPECTED_TOTAL_SIZE,
        `ProtocolState size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}`
      );
    } catch (err: any) {
      if (err.message.includes("size mismatch")) {
        throw err;
      }
      console.error("    ❌ Error fetching account:", err.message);
      throw err;
    }
  });

  it("2️⃣ RoundState has correct size", async () => {
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const protocol = await program.account.protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    if (currentRoundId === 0) {
      console.log("\n  ⚠️  No rounds initialized yet");
      return;
    }

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Expected size from contract: discriminator (8) + SIZE (159)
    const EXPECTED_DISCRIMINATOR = 8;
    const EXPECTED_STRUCT_SIZE = 159;  // From RoundState::SIZE
    const EXPECTED_TOTAL_SIZE = EXPECTED_DISCRIMINATOR + EXPECTED_STRUCT_SIZE;

    console.log("\n  📊 RoundState Size Check (Round #" + currentRoundId + "):");
    console.log("    Expected total:", EXPECTED_TOTAL_SIZE, "bytes");
    console.log("    Breakdown: 8 (discriminator) + 159 (struct)");

    const accountInfo = await provider.connection.getAccountInfo(roundPda);

    if (!accountInfo) {
      console.log("    ⚠️  RoundState not found");
      return;
    }

    const actualSize = accountInfo.data.length;
    console.log("    Actual size:", actualSize, "bytes");

    if (actualSize !== EXPECTED_TOTAL_SIZE) {
      console.error("    ❌ SIZE MISMATCH DETECTED!");
      console.error(`       Expected: ${EXPECTED_TOTAL_SIZE} bytes`);
      console.error(`       Got: ${actualSize} bytes`);

      throw new Error(
        `RoundState size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}`
      );
    }

    console.log("    ✅ Size is correct!");

    // Try to deserialize
    try {
      const round = await program.account.roundState.fetch(roundPda);
      console.log("    ✅ Deserialization successful");
      console.log("       Round ID:", round.roundId.toNumber());
      console.log("       Epoch:", round.epochInRound);
      console.log("       Tickets Sold:", round.totalTicketsSold.toNumber());
      console.log("       Complete:", round.isComplete);
    } catch (err: any) {
      console.error("    ❌ Deserialization failed:", err.message);
      throw new Error(`Failed to deserialize RoundState: ${err.message}`);
    }

    assert.equal(
      actualSize,
      EXPECTED_TOTAL_SIZE,
      `RoundState size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}`
    );
  });

  it("3️⃣ UserAccount has correct size", async () => {
    const [userPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), admin.toBuffer()],
      program.programId
    );

    // Expected size from contract: discriminator (8) + SIZE (98)
    const EXPECTED_DISCRIMINATOR = 8;
    const EXPECTED_STRUCT_SIZE = 98;  // From UserAccount::SIZE
    const EXPECTED_TOTAL_SIZE = EXPECTED_DISCRIMINATOR + EXPECTED_STRUCT_SIZE;

    console.log("\n  📊 UserAccount Size Check:");
    console.log("    Expected total:", EXPECTED_TOTAL_SIZE, "bytes");

    try {
      const accountInfo = await provider.connection.getAccountInfo(userPda);

      if (!accountInfo) {
        console.log("    ⚠️  UserAccount not created yet (normal if user hasn't deposited)");
        return;
      }

      const actualSize = accountInfo.data.length;
      console.log("    Actual size:", actualSize, "bytes");

      if (actualSize !== EXPECTED_TOTAL_SIZE) {
        console.error("    ❌ SIZE MISMATCH DETECTED!");
        throw new Error(
          `UserAccount size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}`
        );
      }

      console.log("    ✅ Size is correct!");

      // Try to deserialize
      try {
        const user = await program.account.userAccount.fetch(userPda);
        console.log("    ✅ Deserialization successful");
        console.log("       Balance:", user.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("       Round Joined:", user.roundJoined.toNumber());
      } catch (err: any) {
        console.error("    ❌ Deserialization failed:", err.message);
        throw err;
      }

      assert.equal(actualSize, EXPECTED_TOTAL_SIZE);
    } catch (err: any) {
      if (err.message.includes("size mismatch")) {
        throw err;
      }
      console.log("    ⚠️  Could not fetch UserAccount");
    }
  });

  it("4️⃣ ClaimTicket has correct size (if exists)", async () => {
    // Expected size from contract: discriminator (8) + SIZE (58)
    const EXPECTED_DISCRIMINATOR = 8;
    const EXPECTED_STRUCT_SIZE = 58;  // From ClaimTicket::SIZE
    const EXPECTED_TOTAL_SIZE = EXPECTED_DISCRIMINATOR + EXPECTED_STRUCT_SIZE;

    console.log("\n  📊 ClaimTicket Size Check:");
    console.log("    Expected total:", EXPECTED_TOTAL_SIZE, "bytes");
    console.log("    Breakdown: 8 (discriminator) + 58 (struct)");
    console.log("    Note: ClaimTickets only exist after rounds complete");

    // We'll check if any ClaimTickets exist for the admin
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    try {
      const protocol = await program.account.protocolState.fetch(protocolPda);
      const currentRoundId = protocol.currentRound.toNumber();

      // Check for ClaimTickets from recent rounds
      let foundTicket = false;

      for (let roundId = 1; roundId <= currentRoundId; roundId++) {
        const [claimTicketPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("claim"), new BN(roundId).toArrayLike(Buffer, "le", 8), admin.toBuffer()],
          program.programId
        );

        try {
          const accountInfo = await provider.connection.getAccountInfo(claimTicketPda);

          if (accountInfo) {
            foundTicket = true;
            const actualSize = accountInfo.data.length;
            console.log(`    Found ClaimTicket for Round #${roundId}`);
            console.log("    Actual size:", actualSize, "bytes");

            if (actualSize !== EXPECTED_TOTAL_SIZE) {
              console.error("    ❌ SIZE MISMATCH!");
              throw new Error(
                `ClaimTicket size mismatch: expected ${EXPECTED_TOTAL_SIZE}, got ${actualSize}`
              );
            }

            console.log("    ✅ Size is correct!");

            // Try to deserialize
            const ticket = await program.account.claimTicket.fetch(claimTicketPda);
            console.log("    ✅ Deserialization successful");
            console.log("       Prize:", ticket.prizeAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
            console.log("       Claimed:", ticket.claimed);

            assert.equal(actualSize, EXPECTED_TOTAL_SIZE);
            break;  // Only need to check one
          }
        } catch (err) {
          // ClaimTicket doesn't exist for this round, continue
        }
      }

      if (!foundTicket) {
        console.log("    ⚠️  No ClaimTickets found yet (normal if no rounds completed)");
      }
    } catch (err: any) {
      console.log("    ⚠️  Could not check ClaimTickets:", err.message);
    }
  });

  it("5️⃣ CRITICAL: Detect buffer mismatches BEFORE transaction", async () => {
    console.log("\n  🚨 CRITICAL BUFFER LENGTH CHECK");
    console.log("    This test prevents 'Trying to access beyond buffer length' errors");

    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const accountInfo = await provider.connection.getAccountInfo(protocolPda);

    if (!accountInfo) {
      console.log("    ⚠️  ProtocolState not initialized");
      return;
    }

    const EXPECTED_SIZE = 8 + 97;  // Must match contract
    const actualSize = accountInfo.data.length;

    console.log("    Contract expects:", EXPECTED_SIZE, "bytes");
    console.log("    Account has:", actualSize, "bytes");

    if (actualSize < EXPECTED_SIZE) {
      console.error("\n    ❌❌❌ CRITICAL ERROR ❌❌❌");
      console.error(`    Account is TOO SMALL: ${actualSize} < ${EXPECTED_SIZE}`);
      console.error("    Contract added new fields but account wasn't reinitialized!");
      console.error("\n    📋 HOW TO FIX:");
      console.error("    1. Close old account: anchor run close-protocol");
      console.error("    2. Reinitialize: anchor run init-protocol");
      console.error("    3. Re-run tests");

      throw new Error(
        `CRITICAL: Account too small (${actualSize} bytes). ` +
        `Contract expects ${EXPECTED_SIZE} bytes. This WILL cause transaction failures!`
      );
    }

    if (actualSize > EXPECTED_SIZE) {
      console.error("\n    ⚠️  WARNING: Account is LARGER than expected");
      console.error(`    ${actualSize} > ${EXPECTED_SIZE}`);
      console.error("    This might indicate an old contract version.");
      console.error("    Transactions may still work, but verify contract deployment.");
    }

    if (actualSize === EXPECTED_SIZE) {
      console.log("\n    ✅✅✅ BUFFER LENGTH IS CORRECT! ✅✅✅");
      console.log("    Transactions should succeed!");
    }

    assert.equal(
      actualSize,
      EXPECTED_SIZE,
      `Buffer size mismatch detected! This will cause transaction failures.`
    );
  });
});
