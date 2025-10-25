import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import { getParticipants } from "./utils/get_participants";

const PROGRAM_ID = new PublicKey("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

async function testFullFlow() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(require("../target/idl/rafa.json"), provider);

  console.log("🎪 Testing Complete Raffle Flow");
  console.log("================================\n");

  const admin = provider.wallet.publicKey;
  console.log("Admin/Buyer:", admin.toString());

  try {
    // Get protocol and round info
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      PROGRAM_ID
    );

    const protocol = await (program.account as any).protocolState.fetch(protocolPda);
    const currentRoundId = protocol.currentRound.toNumber();

    console.log("Current Round:", currentRoundId);

    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), new BN(currentRoundId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const roundBefore = await (program.account as any).roundState.fetch(roundPda);

    console.log("\n📊 Round State:");
    console.log("  Epoch:", roundBefore.epochInRound);
    console.log("  Tickets Sold:", roundBefore.totalTicketsSold.toNumber());
    console.log("  Total Staked:", roundBefore.totalStakedLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  Is Complete:", roundBefore.isComplete);

    // Step 1: Buy a ticket
    console.log("\n💰 Step 1: Buying 1 ticket (0.01 SOL)...");

    const [userPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), admin.toBuffer()],
      PROGRAM_ID
    );

    const amount = new BN(0.01 * LAMPORTS_PER_SOL);

    const depositTx = await program.methods
      .deposit(amount)
      .accounts({
        user: admin,
        protocolState: protocolPda,
        userAccount: userPda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: roundPda, isSigner: false, isWritable: true }
      ])
      .rpc();

    console.log("✅ Deposit TX:", depositTx);

    await provider.connection.confirmTransaction(depositTx, "confirmed");

    // Check round state after deposit
    const roundAfterDeposit = await (program.account as any).roundState.fetch(roundPda);
    console.log("\n📊 After Deposit:");
    console.log("  Tickets Sold:", roundAfterDeposit.totalTicketsSold.toNumber());
    console.log("  Epoch:", roundAfterDeposit.epochInRound);

    // Check user account
    const userAccount = await (program.account as any).userAccount.fetch(userPda);
    console.log("\n👤 UserAccount Created:");
    console.log("  Owner:", userAccount.owner.toString());
    console.log("  Balance:", userAccount.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  Tickets:", userAccount.ticketStart.toNumber(), "-", userAccount.ticketEnd.toNumber());
    console.log("  Round Joined:", userAccount.roundJoined.toNumber());

    // Step 2: Query participants
    console.log("\n👥 Step 2: Querying participants...");
    const participants = await getParticipants(program, currentRoundId);

    console.log("Found", participants.length, "participant(s)");
    participants.forEach((p, i) => {
      const numTickets = p.ticketEnd - p.ticketStart + 1;
      console.log(`  ${i + 1}. ${p.owner.toString().slice(0, 8)}... - ${numTickets} tickets`);
    });

    // Step 3: Call crank to advance/finalize
    console.log("\n⚙️  Step 3: Calling crank...");

    const crankTx = await program.methods
      .crank()
      .accounts({
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts(
        participants.map(p => ({ pubkey: p.pubkey, isSigner: false, isWritable: false }))
      )
      .rpc();

    console.log("✅ Crank TX:", crankTx);

    await provider.connection.confirmTransaction(crankTx, "confirmed");

    // Check final state
    const roundFinal = await (program.account as any).roundState.fetch(roundPda);
    console.log("\n📊 Final Round State:");
    console.log("  Epoch:", roundFinal.epochInRound);
    console.log("  Is Complete:", roundFinal.isComplete);
    console.log("  Winner:", roundFinal.winner?.toString() || "None");
    console.log("  Winning Ticket:", roundFinal.winningTicket.toNumber());

    if (roundFinal.isComplete) {
      console.log("\n🎉🎉🎉 ROUND FINALIZED!");
      console.log("Winner:", roundFinal.winner.toString());
      console.log("\nNext: Admin should call create_claim_ticket for the winner");
    } else {
      console.log("\n⏳ Round not finalized yet - needs more time or more participants");
    }

  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    if (err.logs) {
      console.error("\nLogs:");
      err.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

testFullFlow();
