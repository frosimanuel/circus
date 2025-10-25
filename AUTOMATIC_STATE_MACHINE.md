# Fully Automatic State Machine

## Overview

The raffle system now operates as a **fully automatic state machine** where all state transitions happen based on time, with **no manual buttons** required.

## How It Works

### Contract State Machine

The Solana smart contract (`lib.rs`) automatically advances through states:

```
Round Start (Epoch 1)
       ↓ (2 minutes)
    Epoch 2
       ↓ (2 minutes)
    Epoch 3 (deposits blocked)
       ↓ (2 minutes)
  Winner Selected
       ↓ (auto-init)
Next Round Starts
```

### Automatic Transitions

**1. Epoch Advancement (Lines 121-134 in lib.rs)**
```rust
// Auto-advance epoch based on elapsed time
if target_epoch > round_state.epoch_in_round {
    msg!("⏰ Auto-advancing epoch {} → {}", round_state.epoch_in_round, target_epoch);
    round_state.epoch_in_round = target_epoch;
}
```

**2. Winner Selection (Lines 136-183 in lib.rs)**
```rust
// Check if round should be finalized (epoch 3 ended)
if round_state.epoch_in_round >= 3 {
    let epoch_3_end_ms = round_state.start_epoch + (3 * EPOCH_DURATION_SECONDS * 1000);

    if current_time_ms >= epoch_3_end_ms && round_state.total_tickets_sold > 0 {
        // AUTO-FINALIZE: Select winner!
        // ... winner selection logic ...
    }
}
```

**3. Round Initialization (useAutoCrank hook)**
```typescript
// Auto-initialize new round when previous completes
if (roundState.isComplete && !isInitializingRound.current) {
    // Initialize Round #N+1 automatically
}
```

## User Experience

### What You See

**Epoch 1 or 2 Expires:**
```
⚡ AUTO-ADVANCING EPOCH X...
Please approve the transaction to continue
```

**Epoch 3 Completes:**
```
🎲 DRAWING WINNER
⚡ Selecting winner automatically...
Please approve the transaction to continue
```

**Round Completes:**
```
⚡ STARTING ROUND #X...
Please approve the transaction to continue
```

### What You Do

**Only one action required:** Click **"Approve"** when your wallet prompts you.

That's it! The system handles everything else automatically.

## How Approvals Work

### Why Approvals Are Needed

Solana blockchain **requires signatures** for all state-changing transactions. This is a security feature - no program can modify state without your explicit permission.

The system automatically **triggers** transactions at the right time, but you must **approve** them.

### Approval Flow

```
Timer expires → useAutoCrank detects → Calls crank() → Wallet popup → You approve → State advances
```

### How Often

You'll see approval popups:
- **Every 2 minutes** - Epoch advancement (Epoch 1 → 2, Epoch 2 → 3)
- **After 6 minutes** - Winner selection
- **After round completes** - Next round initialization

**Total: ~3-4 approvals per round** (6 minutes)

## Technical Implementation

### Auto-Crank System (`useAutoCrank.ts`)

Runs every **5 seconds** in the background:

```typescript
const checkAndCrank = async () => {
  // Calculate expected epoch based on elapsed time
  const elapsedMs = currentTime - roundState.startEpoch;
  const epochsPassed = Math.floor(elapsedMs / (EPOCH_DURATION_SECONDS * 1000));
  const expectedEpoch = Math.min(epochsPassed + 1, 3);

  // Auto-advance if needed
  if (expectedEpoch > roundState.epochInRound) {
    await callCrank(); // Triggers wallet approval
  }

  // Auto-finalize if Epoch 3 ended
  if (currentEpoch >= 3 && currentTime >= epoch3EndTime) {
    await callCrank(); // Triggers wallet approval
  }

  // Auto-initialize new round if complete
  if (roundState.isComplete) {
    await initRound(); // Triggers wallet approval
  }
};
```

### Timing Configuration

```typescript
const EPOCH_DURATION_SECONDS = 120;  // 2 minutes per epoch
const CHECK_INTERVAL_MS = 5000;      // Check every 5 seconds
```

### Safety Features

- **Throttling**: Won't spam transactions (15s minimum between cranks)
- **Single transaction**: Only one crank running at a time
- **State verification**: Checks current state before triggering
- **Error handling**: Gracefully handles failed transactions

## Key Differences from Manual System

### Before (Manual)
```
❌ Epoch expires → Shows "ADVANCE NOW" button → User must click → Approve
❌ Round ends → Shows "DRAW WINNER" button → User must click → Approve
❌ Round complete → Shows "START ROUND" button → User must click → Approve
```

### After (Automatic)
```
✅ Epoch expires → Auto-triggers crank → User approves → Done
✅ Round ends → Auto-triggers crank → User approves → Done
✅ Round complete → Auto-triggers init → User approves → Done
```

## Benefits

1. **State Machine Behavior** - Contract logic determines when to advance (not UI buttons)
2. **Time-Based Transitions** - Everything happens when it should based on elapsed time
3. **No User Intervention** - Just approve when prompted, no clicking buttons
4. **Reliable** - Won't get "stuck" waiting for manual action
5. **Transparent** - UI shows what's happening automatically

## Limitations

### Solana Blockchain Constraints

Solana programs are **passive** - they don't execute on their own. They require:
- Someone to send a transaction
- That transaction to be signed by a wallet

**This is by design** - prevents programs from draining wallets without permission.

### Approval Requirement

You **cannot** avoid wallet approvals because:
- Solana requires signatures for all state changes
- No way to "auto-approve" transactions (security risk)
- Even read-only operations don't advance state

### Alternative (Not Implemented)

**Backend Bot Approach:**
- Run a server with a dedicated wallet
- Server calls crank() automatically every 2 minutes
- Users never see approval popups
- **Downside**: Requires infrastructure, costs money, centralized

We chose the **frontend approach** because:
- Fully decentralized
- No infrastructure costs
- Users control their wallets
- Permissionless (anyone can help advance)

## Summary

The system is now a **pure state machine**:
- ✅ State transitions based on time (not UI buttons)
- ✅ Contract logic determines when to advance
- ✅ UI reflects state automatically
- ✅ Users only approve (don't trigger)

**Just approve when prompted - the system handles the rest automatically!**
