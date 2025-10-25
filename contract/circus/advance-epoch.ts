import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rafa } from "./target/types/rafa";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafa as Program<Rafa>;

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  // Get protocol state
  const state = await program.account.protocolState.fetch(protocolPda);
  const roundId = state.currentRound.toNumber();

  console.log("Current Round:", roundId);
  console.log("Admin:", provider.wallet.publicKey.toString());

  // Get round state
  const [roundPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("round"),
      protocolPda.toBuffer(),
      Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8)),
    ],
    program.programId
  );

  const round = await program.account.roundState.fetch(roundPda);
  console.log("Current Epoch:", round.epochInRound);
  console.log("Is Complete:", round.isComplete);

  if (round.isComplete) {
    console.log("\n❌ Round is already complete. Please start a new round.");
    return;
  }

  if (round.epochInRound >= 3) {
    console.log("\n❌ Already at Epoch 3. Cannot advance further.");
    console.log("You need to select a winner to complete the round.");
    return;
  }

  // Advance epoch
  console.log("\n⏰ Advancing to Epoch", round.epochInRound + 1, "...");

  const tx = await program.methods
    .advanceEpoch()
    .accountsPartial({
      admin: provider.wallet.publicKey,
      protocolState: protocolPda,
      roundState: roundPda,
    })
    .rpc();

  console.log("✅ Epoch advanced successfully!");
  console.log("Transaction:", tx);
  console.log("Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

  // Check new state
  const newRound = await program.account.roundState.fetch(roundPda);
  console.log("\n📊 New Epoch:", newRound.epochInRound);
}

main().catch(console.error);
