# Contract Changes Summary

## Changes Made (Not Yet Deployed)

### 1. Fixed Ticket Pricing ✅
**What**: Enforce 0.01 SOL per ticket, whole tickets only
**Why**: Clear pricing, no fractional tickets, better UX

**Changes:**
- Added `TICKET_PRICE_LAMPORTS = 10,000,000` constant
- Modified `deposit()` to validate exact multiples
- Added `InvalidTicketAmount` error code

**Examples:**
- ✅ 0.01 SOL = 1 ticket
- ✅ 0.05 SOL = 5 tickets
- ❌ 0.015 SOL = ERROR

### 2. Ticket Number Assignment ✅
**What**: Sequential ticket numbering (like a real lottery)
**Why**: Users can see "You own tickets #42-#46"

**Changes:**
- Added `total_tickets_sold` to `RoundState`
- Added `ticket_start` and `ticket_end` to `UserAccount`
- Modified `deposit()` to assign sequential numbers
- Updated account sizes

**Example:**
```
User A buys 5 tickets → Gets tickets #1-#5
User B buys 3 tickets → Gets tickets #6-#8
User C buys 10 tickets → Gets tickets #9-#18
```

### 3. Fast Epoch Duration (For Testing) ✅
**What**: 2-minute epochs instead of 1 week
**Why**: Quick demo/testing without waiting

**Changes:**
- Added `EPOCH_DURATION_SECONDS = 120` constant
- For production: change to 604800 (1 week)

**Demo Flow:**
- Minute 0-2: Epoch 1 (users deposit)
- Minute 2-4: Epoch 2 (snapshots taken)
- Minute 4-6: Epoch 3 (final snapshot)
- Minute 6+: Select winner

## Account Structure Changes

### RoundState (134 bytes → 142 bytes)
```rust
pub struct RoundState {
    pub round_id: u64,
    pub epoch_in_round: u8,
    pub start_epoch: u64,
    pub stake_account: Pubkey,
    pub total_prize_lamports: u64,
    pub total_tickets_sold: u64,  // NEW ✨
    pub winner: Option<Pubkey>,
    pub is_complete: bool,
    pub vrf_request: Option<Pubkey>,
    pub bump: u8,
}
```

### UserAccount (98 bytes → 114 bytes)
```rust
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub ticket_start: u64,  // NEW ✨
    pub ticket_end: u64,    // NEW ✨
    pub snapshot_balances: [u64; 3],
    pub snapshots_recorded_mask: u8,
    pub round_joined: u64,
    pub pending_withdrawal_amount: u64,
    pub pending_withdrawal_round: u64,
    pub bump: u8,
}
```

## Frontend Changes

### Transaction Hook Updated
- `useRaffleTransactions.ts`:
  - Validates ticket amounts client-side
  - Passes round PDA in `remaining_accounts`
  - Better error messages

### Utility Functions Added
- `src/utils/tickets.ts`:
  - `solToTickets()` - Convert SOL to ticket count
  - `ticketsToSol()` - Convert tickets to SOL
  - `isValidTicketAmount()` - Validate amounts
  - Helper functions for display

## Testing Flow

### Quick Demo Script:
```bash
# Minute 0: Initialize round
node scripts/initialize.js devnet

# Minute 0-2: Users deposit (Epoch 1)
# Via frontend or:
anchor run deposit 10000000  # 1 ticket = 0.01 SOL

# Minute 2: Advance to Epoch 2
node scripts/manage.js devnet advance-epoch

# Minute 4: Advance to Epoch 3
node scripts/manage.js devnet advance-epoch

# Minute 6: Select winner
node scripts/manage.js devnet select-winner

# Start new round
node scripts/manage.js devnet init-round 2
```

### For Production:
Change `EPOCH_DURATION_SECONDS` from `120` to `604800` (1 week)

## Breaking Changes ⚠️

**Important**: These changes modify account structures, so they are **NOT compatible** with existing accounts.

**Options:**
1. **Deploy new program** (new program ID)
2. **Upgrade + migrate** (complex, requires data migration)
3. **For testing**: Just redeploy to devnet (wipe old data)

**Recommendation for current devnet deployment:**
- The devnet program was just initialized
- Very few/no users yet
- **Best approach**: Just redeploy with new changes

## Deployment Plan

### Option 1: Fresh Deploy (Recommended for Now)
```bash
# 1. Build new version
anchor build

# 2. Get new program ID
solana address -k target/deploy/rafa-keypair.json

# 3. Update declare_id! in lib.rs

# 4. Rebuild
anchor build

# 5. Deploy
anchor deploy --provider.cluster devnet

# 6. Initialize fresh
node scripts/initialize.js devnet
```

### Option 2: Keep Same Program ID (More Complex)
Would require:
- Data migration functions
- Careful upgrade process
- Account reinitialization

## What Users Will See

### Before (Old):
```
Balance: 0.053 SOL staked
```

### After (New):
```
Tickets Owned: #42-#46 (5 tickets)
Balance: 0.05 SOL
```

Much clearer and more like a real lottery!

## Constants Reference

```rust
// Ticket price
TICKET_PRICE_LAMPORTS: u64 = 10_000_000  // 0.01 SOL

// Epoch duration
EPOCH_DURATION_SECONDS: i64 = 120  // 2 minutes (testing)
// EPOCH_DURATION_SECONDS: i64 = 604800  // 1 week (production)
```

## Next Steps

1. ✅ Contract changes completed
2. ✅ Frontend integration updated
3. ⏳ Ready to deploy when you say
4. ⏳ Test ticket numbering
5. ⏳ Test quick epoch progression
6. ⏳ Verify UI shows ticket numbers

## Notes

- All changes are local (not deployed yet)
- Contract builds successfully
- Frontend code updated to match
- Ready for your approval to deploy
- Can make more changes if needed!

**Want to make any other changes before deploying?**
