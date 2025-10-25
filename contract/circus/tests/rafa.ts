import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Rafa } from "../target/types/";

describe("rafa mvp flow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.rafa as Program<Rafa>;

  const protocolPdaSeed = Buffer.from("state");
  const userSeed = (pubkey: PublicKey) => [Buffer.from("user"), pubkey.toBuffer()];
  const roundSeed = (id: number) => [Buffer.from("round"), Buffer.from(new anchor.BN(id).toArrayLike(Buffer, "le", 8))];

  it("initialize, seed_prize, init_round, deposit", async () => {
    // fund wallet on local validator
    const sig = await provider.connection.requestAirdrop(
      provider.wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [protocolPdaSeed],
      program.programId
    );

    // initialize
    const validator = Keypair.generate().publicKey; // dummy
    await program.methods
      .initialize(validator)
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // seed_prize
    await program.methods
      .seedPrize(new anchor.BN(1_000_000)) // 0.001 SOL
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // init_round
    const nextRoundId = 1;
    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), Buffer.from(new anchor.BN(nextRoundId).toArrayLike(Buffer, "le", 8))],
      program.programId
    );
    const stakeAccount = Keypair.generate();
    await program.methods
      .initRound(new anchor.BN(nextRoundId), new anchor.BN(12345))
      .accounts({
        admin: provider.wallet.publicKey,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // deposit
    const [userPda] = PublicKey.findProgramAddressSync(userSeed(provider.wallet.publicKey), program.programId);
    await program.methods
      .deposit(new anchor.BN(500_000))
      .accounts({
        user: provider.wallet.publicKey,
        protocolState: protocolPda,
        userAccount: userPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // fetch and verify state
    const protocol = await program.account.protocolState.fetch(protocolPda);
    expect(protocol.currentRound.toNumber()).to.eq(nextRoundId);
    expect(protocol.prizeSeedAmount.toNumber()).to.eq(1_000_000);

    const user = await program.account.userAccount.fetch(userPda);
    expect(user.balance.toNumber()).to.eq(500_000);
  });

  it("snapshot epoch 1 for two users (batched)", async () => {
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [protocolPdaSeed],
      program.programId
    );
    // init round 2 to isolate from previous test state
    const nextRoundId = 2;
    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), Buffer.from(new anchor.BN(nextRoundId).toArrayLike(Buffer, "le", 8))],
      program.programId
    );
    const stakeAccount = Keypair.generate();
    await program.methods
      .initRound(new anchor.BN(nextRoundId), new anchor.BN(12346))
      .accounts({
        admin: anchor.AnchorProvider.env().wallet.publicKey,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // two users: provider and alt keypair via airdrop
    const [user1Pda] = PublicKey.findProgramAddressSync(userSeed(anchor.AnchorProvider.env().wallet.publicKey), program.programId);
    // ensure user1 has some deposit from earlier test
    const user2 = Keypair.generate();
    // airdrop user2 and deposit
    const airdrop2 = await program.provider.connection.requestAirdrop(user2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await program.provider.connection.confirmTransaction(airdrop2, "confirmed");
    const [user2Pda] = PublicKey.findProgramAddressSync(userSeed(user2.publicKey), program.programId);
    await program.methods
      .deposit(new anchor.BN(700_000))
      .accounts({
        user: user2.publicKey,
        protocolState: protocolPda,
        userAccount: user2Pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    // snapshot batch for epoch 1 using both user accounts as remaining
    await program.methods
      .takeSnapshotBatch()
      .accounts({
        protocolState: protocolPda,
        roundState: roundPda,
      })
      .remainingAccounts([
        { pubkey: user1Pda, isSigner: false, isWritable: true },
        { pubkey: user2Pda, isSigner: false, isWritable: true },
      ])
      .rpc();

    const u1 = await program.account.userAccount.fetch(user1Pda);
    const u2 = await program.account.userAccount.fetch(user2Pda);
    // epoch 1 index 0 should equal balances at snapshot time
    expect(u1.snapshotBalances[0].toNumber()).to.eq(u1.balance.toNumber());
    expect(u2.snapshotBalances[0].toNumber()).to.eq(u2.balance.toNumber());

    // idempotency: call again and values remain the same
    await program.methods
      .takeSnapshotBatch()
      .accounts({ protocolState: protocolPda, roundState: roundPda })
      .remainingAccounts([
        { pubkey: user1Pda, isSigner: false, isWritable: true },
        { pubkey: user2Pda, isSigner: false, isWritable: true },
      ])
      .rpc();
    const u1b = await program.account.userAccount.fetch(user1Pda);
    expect(u1b.snapshotBalances[0].toNumber()).to.eq(u1.snapshotBalances[0].toNumber());
  });

  it("full flow with multiple wallets and local winner", async () => {
    const [protocolPda] = PublicKey.findProgramAddressSync(
      [protocolPdaSeed],
      program.programId
    );
    // start new round 3
    const roundId = 3;
    const [roundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), protocolPda.toBuffer(), Buffer.from(new anchor.BN(roundId).toArrayLike(Buffer, "le", 8))],
      program.programId
    );
    const stakeAccount = Keypair.generate();
    await program.methods
      .initRound(new anchor.BN(roundId), new anchor.BN(99999))
      .accounts({
        admin: anchor.AnchorProvider.env().wallet.publicKey,
        protocolState: protocolPda,
        stakeAccount: stakeAccount.publicKey,
        roundState: roundPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Two users: userA, userB
    const userA = Keypair.generate();
    const userB = Keypair.generate();
    for (const kp of [userA, userB]) {
      const sig = await program.provider.connection.requestAirdrop(kp.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
      await program.provider.connection.confirmTransaction(sig, "confirmed");
    }

    const [userAPda] = PublicKey.findProgramAddressSync(userSeed(userA.publicKey), program.programId);
    const [userBPda] = PublicKey.findProgramAddressSync(userSeed(userB.publicKey), program.programId);

    // deposits
    await program.methods
      .deposit(new anchor.BN(600_000))
      .accounts({ user: userA.publicKey, protocolState: protocolPda, userAccount: userAPda, systemProgram: SystemProgram.programId })
      .signers([userA])
      .rpc();
    await program.methods
      .deposit(new anchor.BN(1_000_000))
      .accounts({ user: userB.publicKey, protocolState: protocolPda, userAccount: userBPda, systemProgram: SystemProgram.programId })
      .signers([userB])
      .rpc();

    // snapshot epoch 1
    console.log("[EPOCH 1] taking snapshot for userA, userB");
    await program.methods
      .takeSnapshotBatch()
      .accounts({ protocolState: protocolPda, roundState: roundPda })
      .remainingAccounts([
        { pubkey: userAPda, isSigner: false, isWritable: true },
        { pubkey: userBPda, isSigner: false, isWritable: true },
      ])
      .rpc();

    // advance to epoch 2 and snapshot
    await program.methods.advanceEpoch().accounts({ admin: anchor.AnchorProvider.env().wallet.publicKey, protocolState: protocolPda, roundState: roundPda }).rpc();
    console.log("[EPOCH 2] taking snapshot");
    await program.methods
      .takeSnapshotBatch()
      .accounts({ protocolState: protocolPda, roundState: roundPda })
      .remainingAccounts([
        { pubkey: userAPda, isSigner: false, isWritable: true },
        { pubkey: userBPda, isSigner: false, isWritable: true },
      ])
      .rpc();

    // advance to epoch 3 and snapshot
    await program.methods.advanceEpoch().accounts({ admin: anchor.AnchorProvider.env().wallet.publicKey, protocolState: protocolPda, roundState: roundPda }).rpc();
    console.log("[EPOCH 3] taking snapshot");
    await program.methods
      .takeSnapshotBatch()
      .accounts({ protocolState: protocolPda, roundState: roundPda })
      .remainingAccounts([
        { pubkey: userAPda, isSigner: false, isWritable: true },
        { pubkey: userBPda, isSigner: false, isWritable: true },
      ])
      .rpc();

    // choose winner locally (deterministic seed for test)
    const seed = new anchor.BN(123456789);
    await program.methods
      .selectWinnerLocal(seed)
      .accounts({ admin: anchor.AnchorProvider.env().wallet.publicKey, protocolState: protocolPda, roundState: roundPda })
      .remainingAccounts([
        { pubkey: userAPda, isSigner: false, isWritable: false },
        { pubkey: userBPda, isSigner: false, isWritable: false },
      ])
      .rpc();

    const round = await program.account.roundState.fetch(roundPda);
    console.log('[WINNER]', round.winner?.toBase58());
    expect(round.winner).to.not.be.null;
  });
});
