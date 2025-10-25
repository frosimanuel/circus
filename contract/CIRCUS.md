Objective
This document is the technical specification for an MVP of Rafa, a no-loss staking raffle on Solana. It prioritizes correctness, on-chain feasibility, and a realistic delivery path for a PoC on devnet/testnet.

0. MVP Scope and Practical Adjustments
- Network: devnet/testnet first. Mainnet readiness is a later milestone.
- Yield source: native SOL staking via a single pooled stake account per round (not per-user). Rewards from round N are realized and payable during round N+1 after the deactivation cooldown. Seeded prizes are supported to avoid liquidity gaps.
- Randomness: Switchboard VRF v2 on devnet with a pre-provisioned queue. For local-only development, a clearly marked insecure fallback may be used. No insecure randomness on public networks.
- Snapshotting: performed in batches, not by iterating all users in a single instruction. This avoids compute and account traversal limits.
- Withdrawals: not instant. Requests are queued and paid after harvest or from available seed liquidity. Users forfeit current-round tickets when requesting.

1. High-Level System Architecture
The system consists of three primary components:

On-Chain Program (Anchor/Rust): Manages deposits, snapshots, pooled staking, round lifecycle, random selection, and payouts.

Off-Chain Service (Keeper Bot, TypeScript/Node.js): Runs on a schedule, detects epoch transitions, executes batched snapshots, triggers stake delegate/deactivate/withdraw flows, and finalizes rounds.

Frontend (Next.js/TypeScript): User interface for deposits, withdrawal requests, viewing tickets/prizes, and winners.

2. Core Concepts & Logic
Yield Source (native stake, pooled): The program creates and manages one stake account per round, delegated to a configured validator. At the end of the round, it starts deactivation; rewards become withdrawable in the next epoch (i.e., next round). Seeded prize lamports can be used to ensure timely payouts even before rewards settle.

Raffle Cycle (3-epoch round, pipelined rewards): Each round lasts 3 epochs. Because stake rewards settle after a cooldown, round N’s prize is paid from the previously harvested (round N-1) rewards plus any seed. Round N stake is deactivated at its end so rewards are realized for round N+1.

Epoch Snapshots (batched): At the start of each epoch in a round, the keeper calls a batched snapshot instruction repeatedly until all users are covered. Each call updates up to a bounded number of user accounts passed as remaining accounts. This avoids scanning arbitrary program state inside a single transaction.

Ticket Calculation: Total Tickets = snapshot_epoch1_balance + snapshot_epoch2_balance + snapshot_epoch3_balance.

Withdrawal Model (queued): Users request withdrawals any time. They forfeit tickets for the current round upon request. Principal is paid from harvested rewards and liquidity after the next harvest, not immediately. For the MVP, withdrawals are processed in a keeper-driven batch after harvest; no partial/instant withdrawals.

Randomness (VRF): Use Switchboard VRF v2. The program requests randomness after the third snapshot is complete. A secure devnet configuration with a pre-provisioned queue and oracle is assumed. A local-only fallback is allowed strictly for local development.

3. On-Chain Program Specification (Anchor/Rust)
3.1. State & Accounts (Structs)
Generate the following account structures:

Rust

use anchor_lang::prelude::*;

// Global state of the protocol (singleton PDA)
#[account]
pub struct ProtocolState {
    pub admin: Pubkey,                // Authority for admin/upgrade functions
    pub validator: Pubkey,            // Validator to delegate stake to
    pub current_round: u64,           // Current round id
    pub prize_seed_amount: u64,       // Seed liquidity (lamports)
    pub bump: u8,                     // PDA bump
}

// State for the active or recently closed round
#[account]
pub struct RoundState {
    pub round_id: u64,
    pub epoch_in_round: u8,           // 1, 2, or 3
    pub start_epoch: u64,             // Epoch at round start
    pub stake_account: Pubkey,        // Pooled stake account for this round
    pub total_prize_lamports: u64,    // Prize budget available to pay (seed + harvested)
    pub winner: Option<Pubkey>,
    pub is_complete: bool,            // True once winner chosen and payouts initiated
    pub vrf_request: Option<Pubkey>,  // Switchboard VRF request account
    pub bump: u8,                     // PDA bump
}

// Per-user protocol account (PDA)
#[account]
pub struct UserAccount {
    pub owner: Pubkey,                // User wallet
    pub balance: u64,                 // Deposited lamports (escrowed)
    pub snapshot_balances: [u64; 3],  // Balances at epoch boundaries
    pub snapshots_recorded_mask: u8,  // Bitmask of recorded epochs (bit0=e1, bit1=e2, bit2=e3)
    pub round_joined: u64,            // Round when user first deposited
    pub pending_withdrawal_amount: u64,
    pub pending_withdrawal_round: u64,// Round after which withdrawal can be paid
    pub bump: u8,
}

// Note: The program manages native stake accounts via PDAs as authorities.
// One pooled stake account per round keeps staking logic tractable for the MVP.

3.2. Instructions (Functions)
Implement the following instructions. Batch-oriented calls accept remaining accounts for pagination.

Instruction	Caller	Description
initialize	Admin	Initialize ProtocolState with admin and validator; set current_round=0.
seed_prize	Admin	Deposit SOL to seed the prize vault (lamports accrue to RoundState or ProtocolState as designed).
init_round	Keeper	Start a new round (increment round id, set start_epoch, create stake account for round).
deposit	User	(RF-01) Transfer SOL into escrow; create UserAccount if needed; update balance.
request_withdrawal	User	(RF-02) Mark amount for withdrawal; forfeit current-round tickets; set pending_withdrawal_round to current_round.
process_withdrawals_batch	Keeper	Process pending withdrawals after harvest using available liquidity; bounded batch.
take_snapshot_batch	Keeper	(RF-04, RF-06) Write snapshots for a batch of users for the current epoch_in_round; idempotent per user/epoch.
delegate_stake	Keeper	Create and delegate the round’s pooled stake account with aggregated deposits not already staked.
deactivate_stake	Keeper	At round end, initiate deactivation of the round’s stake account.
harvest_rewards	Keeper	After cooldown epoch, withdraw stake principal+rewards into prize liquidity for payouts.
request_randomness	Keeper	(RF-09) Request VRF after third snapshot is fully recorded.
fulfill_randomness	VRF	(RF-10) VRF callback verifies and stores randomness; program determines winner and allocates prize.
close_round	Keeper	Mark round complete after payouts; then call init_round to continue.

Notes:
- Snapshotting is batched and idempotent per (user, epoch). The keeper repeatedly calls take_snapshot_batch passing a page of UserAccounts as remaining accounts.
- Rewards timing is pipelined: round N prize is paid from harvested rewards of round N-1 plus seed liquidity.
- For MVP, prize transfer happens after randomness is fulfilled and liquidity is available. If liquidity is insufficient, partial payouts are deferred to the next harvest.

3.3. CPIs (Cross-Program Invocations)
The program performs CPIs to:

System Program: Account creation and lamport transfers.

Stake Program: Create stake account, delegate, deactivate, and withdraw.

Switchboard VRF v2: Request and verify randomness.

4. Off-Chain Service Specification (Keeper Bot)
The keeper automates time-sensitive flows and batching.

Trigger: Run every 2–5 minutes (cron or long-lived loop).

Logic:

1) Fetch chain epoch and current RoundState.
2) If a new epoch has begun (chain_epoch > start_epoch + epoch_in_round - 1):
   - Increment epoch_in_round in-program (explicit instruction) and begin snapshotting for the new epoch.
   - Call take_snapshot_batch repeatedly with pages of UserAccounts until all are recorded for this epoch.
3) If epoch_in_round == 3 and a new epoch has begun:
   - Ensure snapshots are fully recorded for epoch 3.
   - Call request_randomness.
   - Call deactivate_stake to start cooldown for this round’s stake account.
   - If prior round cooldown finished, call harvest_rewards and then process_withdrawals_batch repeatedly until the queue is drained or liquidity exhausted.
4) If round is complete and payouts are done/queued, call init_round to start the next round and delegate_stake for new deposits.

The keeper should also call delegate_stake opportunistically to stake new deposits early in a round if not yet delegated.

5. Frontend Specification (Next.js dApp)
Functional requirements:

RF-12: Wallet Connection: "Connect Wallet" using @solana/wallet-adapter (Phantom, Solflare).

RF-13: Pool Data Display:
- Total SOL deposited (TVL).
- Current prize liquidity available (harvested + seed).
- Round progress: "Epoch X of 3" with a progress indicator.

RF-14: User Data Display (when connected):
- User’s deposited SOL balance.
- Calculated tickets for the current round based on snapshots recorded so far.
- Simple transaction history (RPC fetch).

RF-15: Interaction Forms:
- Deposit form (SOL amount input + submit).
- Withdraw request form explaining delayed payout and ticket forfeiture.

RF-16: Results Display:
- Most recent round winner and prize paid.
- Note when prize is sourced from prior round harvest vs seed.

6. Implementation Details and Accuracy Notes
- Account iteration: On-chain programs cannot enumerate arbitrary PDAs. Snapshotting and withdrawals MUST be batched by passing UserAccounts as remaining accounts from the keeper.
- Stake lifecycle timing: Rewards are only realized after deactivation completes in the next epoch. The MVP uses a one-round pipeline for liquidity. Seed lamports smooth payouts while waiting.
- Idempotency: Snapshot and withdrawal processing instructions must be idempotent and bounded per call to avoid exceeding compute limits.
- PDA bumps: Include bumps in PDAs used for authority over stake accounts and state accounts.
- Dev-only randomness: If a local fallback is implemented, it must be gated to local/test builds and disabled on public networks.

7. Known Limitations and Phase 2 Targets
- Multiple validators and stake accounts per round for diversification.
- Continuous staking with liquidity buffer for partial instant withdrawals.
- Replace pooled native stake with a stake-pool CPI (e.g., Marinade/Jito) if instant withdrawals are desired.
- Robust VRF queue management and monitoring.

With these adjustments, the MVP remains faithful to Rafa’s design while being technically feasible to implement and demo on devnet/testnet.