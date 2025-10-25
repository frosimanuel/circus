# 🎨 FRONTEND UPDATES - Autonomous Raffle System

**Date**: 2025-10-25
**Status**: ✅ READY FOR TESTING

---

## 📦 FILES UPDATED

### ✅ **1. IDL**
- **File**: `src/idl/rafa.json`
- **Action**: Copied new IDL from contract build
- **Changes**: Added ClaimTicket accounts, new instruction signatures

### ✅ **2. Config - PDA Helpers**
- **File**: `src/config/solana.ts`
- **Added**: `getClaimTicketPDA(roundId, winnerPubkey)` function
- **Updated**: `getRoundStatePDA()` to accept BN or number

### ✅ **3. Transaction Hook**
- **File**: `src/hooks/useRaffleTransactions.ts`
- **Changes**:
  - `claimPrize(roundId?)` - Now takes optional roundId parameter
  - `processWithdrawal(roundId?)` - Now takes optional roundId parameter
  - Both functions auto-detect roundId from UserAccount if not provided
  - Added ClaimTicket PDA derivation in claimPrize

### ✅ **4. State Hook**
- **File**: `src/hooks/useRaffleState.ts`
- **New Types**:
  - Updated `ProtocolState` with `totalUnclaimedPrizes`
  - Updated `RoundState` with `endEpoch`, `totalStakedLamports`, `prizeClaimed`
  - Added `ClaimTicket` interface
- **New State**:
  - `claimTickets: ClaimTicket[]` - User's unclaimed prizes
- **New Logic**:
  - Fetches user's ClaimTickets from last 10 rounds
  - Filters out already claimed tickets

---

## 🎯 WHAT'S NEW IN THE HOOKS

### **claimPrize() Hook**

**Before:**
```typescript
const { claimPrize } = useRaffleTransactions();
await claimPrize();  // Claims from current round only
```

**After:**
```typescript
const { claimPrize } = useRaffleTransactions();

// Claim from current round (auto-detects)
await claimPrize();

// OR claim from specific round
await claimPrize(3);  // Claim from Round #3
```

### **processWithdrawal() Hook**

**Before:**
```typescript
await processWithdrawal();  // Withdraws from current round
```

**After:**
```typescript
// Withdraw from current round (auto-detects)
await processWithdrawal();

// OR withdraw from specific round
await processWithdrawal(2);  // Withdraw from Round #2
```

### **useRaffleState() Hook**

**Before:**
```typescript
const { roundState, userAccount } = useRaffleState();
```

**After:**
```typescript
const {
  roundState,      // Current round info
  userAccount,     // User's participation
  claimTickets,    // 🆕 Array of unclaimed prizes!
  protocolState
} = useRaffleState();

// Example claimTickets:
// [
//   { roundId: 3, prizeAmount: 100000000, stakeAmount: 50000000, claimed: false },
//   { roundId: 5, prizeAmount: 150000000, stakeAmount: 75000000, claimed: false }
// ]
```

---

## 🎨 UI COMPONENT UPDATES NEEDED

### **StakingRaffle.tsx** - Show Unclaimed Prizes

Add this section to show user's unclaimed wins:

```tsx
const { claimTickets } = useRaffleState();
const { claimPrize } = useRaffleTransactions();

// Show unclaimed prizes section
{claimTickets.length > 0 && (
  <div className="unclaimed-prizes-section">
    <h3>💰 YOUR UNCLAIMED WINS</h3>
    {claimTickets.map((ticket) => (
      <div key={ticket.roundId} className="unclaimed-prize-card">
        <div className="prize-info">
          <span>Round #{ticket.roundId}</span>
          <span>{(ticket.prizeAmount + ticket.stakeAmount) / LAMPORTS_PER_SOL} SOL</span>
        </div>
        <button onClick={() => claimPrize(ticket.roundId)}>
          Claim Prize
        </button>
      </div>
    ))}
  </div>
)}
```

### **Error Handling** - New Error Messages

Update error parsing to handle new error codes:

```typescript
// In deposit error handling:
if (logs.includes('DepositsClosedEpoch3')) {
  errorMessage = 'Deposits closed! Epoch 3 has started. Wait for round to complete.';
}
if (logs.includes('RoundComplete')) {
  errorMessage = 'Round is complete! Please wait for next round to start.';
}

// In claim/withdraw error handling:
if (logs.includes('AlreadyClaimed')) {
  errorMessage = 'Prize already claimed!';
}
if (logs.includes('NotWinner')) {
  errorMessage = 'You are not the winner of this round!';
}
if (logs.includes('WinnerMustClaim')) {
  errorMessage = 'Winners must claim prizes, not withdraw!';
}
if (logs.includes('RoundNotComplete')) {
  errorMessage = 'Round not complete yet. Wait for finalization.';
}
```

---

## 🧪 TESTING CHECKLIST

### **Basic Functionality**
- [ ] Wallet connects successfully
- [ ] Can buy tickets in active round
- [ ] Deposits blocked in Epoch 3 (clear error message)
- [ ] Deposits blocked in completed round (clear error message)

### **Epoch Transitions**
- [ ] Epoch auto-advances from 1 → 2 after 2 minutes
- [ ] Epoch auto-advances from 2 → 3 after 4 minutes total
- [ ] Round auto-finalizes after 6 minutes total

### **Winner Flow**
- [ ] Winner sees their ClaimTicket in `claimTickets` array
- [ ] Can claim prize from completed round
- [ ] Prize claimed successfully (stake + prize)
- [ ] ClaimTicket disappears after claiming

### **Loser Flow**
- [ ] Losers can withdraw stake from completed round
- [ ] Cannot claim prize (clear error)
- [ ] Stake refunded successfully

### **Multi-Round Support**
- [ ] Can claim from old rounds while new round runs
- [ ] Can withdraw from old rounds while new round runs
- [ ] Multiple unclaimed prizes show correctly

---

## 🚀 DEPLOYMENT STEPS

1. ✅ IDL copied to frontend
2. ✅ Hooks updated for new contract
3. ✅ PDA helpers added
4. 🔲 UI components need updating (StakingRaffle.tsx)
5. 🔲 Test with devnet contract
6. 🔲 Verify all flows work

---

## 💡 KEY IMPROVEMENTS

### **Before (Old System)**
- Could only claim from current round
- Round blocked until winner claimed
- No multi-round support
- Manual epoch advancement needed

### **After (New Autonomous System)**
- ✅ Claim from ANY completed round
- ✅ Rounds run independently
- ✅ Multi-round claim support
- ✅ Automatic epoch advancement
- ✅ Automatic winner selection
- ✅ ClaimTickets act like tokens

---

## 📝 NEXT ACTIONS

1. **Update `StakingRaffle.tsx`**:
   - Add unclaimed prizes UI section
   - Update error handling
   - Show epoch auto-advancement status

2. **Test Full Lifecycle**:
   - Initialize Round #1 (admin)
   - Buy tickets (multiple users)
   - Wait 6 minutes
   - Verify auto-finalization
   - Test claims & withdrawals

3. **Create Admin Panel Updates**:
   - Add `create_claim_ticket` button
   - Show round completion status
   - Button to initialize next round

---

## ⚠️ KNOWN LIMITATIONS

1. **ClaimTicket Creation**: Still requires admin to call `create_claim_ticket` after round completes
   - **Workaround**: Admin must create ClaimTickets before winners can claim
   - **Future**: Auto-create during deposit finalization

2. **Round Auto-Start**: Still requires admin to call `init_round` for next round
   - **Workaround**: Admin initializes Round N+1 after Round N completes
   - **Future**: First deposit auto-creates next round

3. **Randomness**: Uses pseudo-random (clock-based)
   - **Impact**: Predictable by validators
   - **Production Fix**: Integrate Switchboard VRF

---

## ✅ READY FOR TESTING!

All hooks are updated and ready. The frontend will automatically:
- Fetch user's unclaimed prizes
- Support multi-round claims
- Handle new error messages
- Work with the autonomous contract

Just need to:
1. Update StakingRaffle UI to show unclaimed prizes
2. Test the full flow on devnet!
