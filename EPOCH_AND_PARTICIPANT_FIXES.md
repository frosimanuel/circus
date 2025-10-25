# 🔧 EPOCH & PARTICIPANT COUNT - ISSUES FIXED

**Date**: 2025-10-25
**Status**: ✅ FIXED - Crank Instruction Added

---

## 🐛 BUGS IDENTIFIED

### **1. Epochs Not Auto-Advancing**
**Problem**: Frontend showed "⚠️ EPOCH EXPIRED - WAITING FOR ADMIN TO ADVANCE"

**Root Cause**:
- Auto-advancement logic EXISTS in the contract (lines 121-186 of `lib.rs`)
- BUT it only triggers during `deposit` transactions
- If no one makes a deposit for several minutes → epoch stays frozen

**Symptoms**:
- Round started 14+ minutes ago
- Should be in Epoch 3 (finalized)
- Actually stuck in Epoch 2
- No deposits made to trigger update

### **2. Participant Count Shows Only 1**
**Problem**: Pool statistics showed 1 participant despite 2+ wallets buying tickets

**Root Cause**:
- `getProgramAccounts` filter in frontend is incorrect
- Not finding UserAccount PDAs properly
- Discriminator filter wrong or missing

---

## ✅ SOLUTION: Crank Instruction

### **What is a Crank?**
A "crank" is a permissionless instruction that anyone can call to advance the state of the protocol without making a deposit. This is common in DeFi protocols (Mango Markets, Zo, etc.).

### **How It Works**
```rust
pub fn crank(ctx: Context<Crank>) -> Result<()> {
    // 1. Check current time
    // 2. Calculate target epoch based on elapsed time
    // 3. Auto-advance epoch if needed
    // 4. Auto-finalize round if epoch 3 ended
    // 5. Select winner from remaining_accounts
}
```

**Key Points**:
- ✅ Callable by ANYONE (no admin required)
- ✅ No deposit needed
- ✅ Advances epoch based on time
- ✅ Finalizes round when epoch 3 complete
- ✅ Selects winner if participants provided

---

## 📊 TEST RESULTS

### **Before Crank:**
```
Round ID: 1
Epoch: 2  ⬅️ Should be 3 (14 minutes elapsed)
Is Complete: false
Total Tickets: 4
```

### **After Crank:**
```
Epoch: 3  ✅ Advanced!
Is Complete: false (needs UserAccounts for finalization)
```

### **What Happened:**
1. ✅ Crank successfully advanced epoch from 2 → 3
2. ⚠️  Didn't finalize because UserAccounts not found (separate issue)
3. ✅ Transaction succeeded: `48QeVopB3Prn24i5L8cgY5cTGJX7LNtmRWJn7jyFskCoeWwSw6Poi1E3gVuGPqHYk3WJUTfwf4GBaRWTe3R24deJ`

---

## 🔧 HOW TO USE CRANK

### **From Contract (Backend)**

```typescript
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const program = ... // Your Anchor program instance
const protocolPda = ... // Protocol PDA
const roundPda = ... // Current round PDA
const userAccounts = ... // Array of participant PDAs

// Call crank
const tx = await program.methods
  .crank()
  .accounts({
    protocolState: protocolPda,
    roundState: roundPda,
  })
  .remainingAccounts(
    userAccounts.map(pubkey => ({
      pubkey,
      isSigner: false,
      isWritable: false
    }))
  )
  .rpc();
```

### **From Frontend (Anyone Can Call)**

The frontend can add a "Refresh Round" button that calls crank:

```typescript
import { useRaffleProgram } from './hooks/useRaffleProgram';
import { getProtocolStatePDA, getRoundStatePDA } from './config/solana';

async function refreshRound() {
  const { program } = useRaffleProgram();

  // Get PDAs
  const [protocolPda] = getProtocolStatePDA();
  const protocol = await program.account.protocolState.fetch(protocolPda);
  const [roundPda] = getRoundStatePDA(protocolPda, protocol.currentRound);

  // Get all participants (will fix this query separately)
  const participants = await getAllParticipants(protocol.currentRound);

  // Call crank
  await program.methods
    .crank()
    .accounts({
      protocolState: protocolPda,
      roundState: roundPda,
    })
    .remainingAccounts(participants)
    .rpc();
}
```

### **Automatic Crank (Recommended)**

Set up a simple cron job or frontend interval:

```typescript
// In your app
useEffect(() => {
  const interval = setInterval(async () => {
    // Call crank every 30 seconds
    try {
      await refreshRound();
    } catch (e) {
      // Silently fail - crank might not need to run
    }
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, []);
```

---

## 🚨 REMAINING ISSUE: Participant Count

### **The Problem**
`getProgramAccounts` is not finding UserAccount PDAs correctly.

**Current Code (Wrong)**:
```typescript
const allAccounts = await connection.getProgramAccounts(
  PROGRAM_ID,
  {
    filters: [
      {
        memcmp: {
          offset: 8,  // ⚠️ Wrong offset
          bytes: "...",  // ⚠️ Wrong bytes
        }
      }
    ]
  }
);
```

**Why It's Wrong**:
1. UserAccount discriminator is different
2. Offset might be incorrect
3. The filter logic doesn't match UserAccount structure

### **The Fix** (Coming Next)

We need to either:

**Option 1**: Find UserAccounts by PDA derivation
```typescript
// For each known wallet that bought tickets
const [userPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("user"), wallet.toBuffer()],
  PROGRAM_ID
);

// Try to fetch
const userAccount = await program.account.userAccount.fetch(userPda);
```

**Option 2**: Query all UserAccounts correctly
```typescript
// Get discriminator for UserAccount
const discriminator = anchor.BorshAccountsCoder.accountDiscriminator("UserAccount");

const accounts = await connection.getProgramAccounts(
  PROGRAM_ID,
  {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: anchor.utils.bytes.bs58.encode(discriminator),
        }
      }
    ]
  }
);
```

**Option 3**: Store participant list on-chain
- Add `Vec<Pubkey>` to RoundState
- Track all participants who buy tickets
- Use this list for winner selection

---

## 📝 DEPLOYMENT STATUS

### **Contract Changes**
- ✅ Added `crank()` instruction
- ✅ Added `Crank` accounts struct
- ✅ Rebuilt contract
- ✅ Deployed to devnet
- ✅ IDL copied to frontend

### **New Program ID** (Same as before)
```
AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi
```

### **Test Scripts Created**
- `scripts/check_epoch_advancement.ts` - Diagnose epoch issues
- `scripts/test_crank.ts` - Test crank instruction

---

## 🎯 NEXT STEPS

### **1. Fix Participant Count Query** (Priority 1)
Need to find the correct way to query UserAccounts so:
- Pool statistics show correct participant count
- Crank can pass UserAccounts for winner selection
- Round can finalize properly

### **2. Add Frontend Crank Integration** (Priority 2)
- Add "Refresh Round" button
- Or automatic crank every 30-60 seconds
- Show toast when epoch advances

### **3. Test Full Lifecycle** (Priority 3)
Once participant query is fixed:
1. Multiple users buy tickets
2. Crank advances epochs automatically
3. Round finalizes at 6 minutes
4. Winner selected correctly
5. Participants withdraw/claim

---

## 💡 KEY LEARNINGS

### **Why Deposit-Only Advancement is Bad**
- Rounds get "stuck" if no activity
- Users see outdated epoch numbers
- Creates confusion ("why isn't it advancing?")
- Requires manual admin intervention

### **Why Crank is Better**
- ✅ Anyone can advance the round
- ✅ No deposits needed
- ✅ Keeps protocol moving forward
- ✅ Better UX (auto-refresh works)
- ✅ Decentralized (no admin dependency)

### **Common in DeFi**
Projects like Mango Markets, Zo, Pyth use cranks for:
- Updating oracle prices
- Settling trades
- Advancing epochs
- Triggering liquidations

---

## ✅ SUMMARY

**Fixed**:
- ✅ Crank instruction added
- ✅ Epoch auto-advancement works
- ✅ Deployed to devnet
- ✅ Tested successfully

**Still Need To Fix**:
- ❌ Participant count query (getProgramAccounts filter)
- ❌ Frontend integration for crank
- ❌ Full lifecycle test with multiple users

**Ready To Test**:
- You can manually call crank from backend
- Epochs will advance correctly
- Just need to fix participant finding

---

## 🧪 MANUAL TEST INSTRUCTIONS

### **Test Crank Now**:
```bash
cd contract/circus
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET=~/.config/solana/id.json \
npx ts-node scripts/test_crank.ts
```

**Expected Output**:
```
✅✅✅ SUCCESS! Epoch advanced from X to Y
```

### **Check Current State**:
```bash
npx ts-node scripts/check_epoch_advancement.ts
```

Shows current epoch, expected epoch, and participant count.

---

**Status**: Crank works! Just need to fix participant query next.
