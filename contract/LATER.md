LATER / Deferred Decisions and Future Refactors

1) Round PDA Seeds
- Current: Using 8-byte round_id planned; refactor in progress to use `#[instruction(round_id: u64)]` with seeds `[b"round", protocol_state.key(), round_id.to_le_bytes()]`.
- Reason: Avoid 1-byte collisions and keep deterministic derivation.
- Impact: Update instruction signature, account seeds, and tests.

2) Prize Vault vs Protocol State
- Current: Protocol lamports (ProtocolState) acts as escrow for deposits and seeded prize.
- Later: Create a dedicated PDA lamport account (e.g., `b"prize_vault"`) to isolate prize/liquidity accounting and simplify authority/signing.
- Rationale: Clear separation of concerns and safer accounting, particularly when adding withdrawals and prize payouts.

3) Stake Authority PDA
- Current: `stake_account` is `UncheckedAccount` and not created/managed yet.
- Later: Introduce a stake authority PDA (e.g., `b"stake_auth"`) that owns stake accounts per round. Implement `delegate_stake`/`deactivate_stake`/`harvest_rewards` CPIs.

4) Snapshot Batching and Indexing
- Current: `take_snapshot_batch` is a stub. Plan to write per-user-per-epoch, idempotent snapshots using remaining accounts pagination.
- Later: Add a global user index or off-chain indexer hints to improve paging. Consider writing an events-based index.

5) Pipelined Rewards Accounting
- Current: Placeholder fields in `RoundState` (`total_prize_lamports`).
- Later: Track harvested rewards and seed usage per round; enforce payouts sourced from previous round’s harvest + seed.

6) VRF Integration
- Current: VRF request fields exist but no integration.
- Later: Wire Switchboard VRF v2 (devnet queue), `request_randomness` and `fulfill_randomness` with winner selection.

7) Withdrawals Flow
- Current: `request_withdrawal` queues amount and clears snapshot mask; no processing.
- Later: Keeper-driven `process_withdrawals_batch` after `harvest_rewards` with liquidity checks and partial fulfillment.

8) Keeper Epoch Detection and Rewards
- Current: Keeper not implemented.
- Later: Use RPC `getEpochInfo` for epoch transitions; `getInflationReward` to cross-check rewards for stake accounts to understand if an epoch finalized and which accounts earned rewards.
- Note on local testing: Local validator does not simulate epochs/inflation. For epoch-sensitive logic, tests should mock time/epoch transitions or run on devnet when verifying real reward flows.

9) Security and Access Control
- Current: Minimal checks.
- Later: Add robust access control (admin-only for lifecycle ops), signer checks, and overflow/underflow audited math.

10) Program Derived Addresses (PDAs) and Bumps
- Current: Bumps stored on state; round seeds pending refactor.
- Later: Standardize seeds and bump storage for all PDAs (state, round, user, stake auth, prize vault if added).


