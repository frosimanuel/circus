# 🧪 AUTONOMOUS RAFFLE TESTING PLAN

**Contract**: Circus Raffle with ClaimTicket System
**Test Environment**: Devnet
**Date**: 2025-10-25

---

## 📋 TEST SCENARIOS

### **Test 1: Basic Round Lifecycle** ⭐ CRITICAL

**Objective**: Verify complete round from start to finish

**Steps**:
1. Initialize protocol
2. Seed prize pool (0.1 SOL)
3. Initialize Round #1 with start_epoch = now
4. User A deposits 10 tickets (0.1 SOL)
5. User B deposits 5 tickets (0.05 SOL)
6. User C deposits 15 tickets (0.15 SOL)
7. Wait 2 minutes → Check epoch auto-advanced to 2
8. User D deposits 10 tickets (0.1 SOL)
9. Wait 2 more minutes → Check epoch auto-advanced to 3
10. Try User E deposit → Should fail with `DepositsClosedEpoch3`
11. Wait 2 more minutes (total 6 min)
12. User F attempts deposit → Should auto-finalize round
13. Verify round.is_complete = true
14. Verify winner selected
15. Admin creates ClaimTicket
16. Winner calls claim_prize
17. Losers call process_withdrawal

**Expected Results**:
- ✅ Epochs auto-advance at 2, 4 minutes
- ✅ Deposits blocked in epoch 3
- ✅ Round auto-finalizes at 6 minutes
- ✅ Winner gets stake + prize (0.1 + X SOL)
- ✅ Losers get stake back only

---

### **Test 2: Auto-Epoch Advancement** ⭐ CRITICAL

**Objective**: Verify time-based epoch transitions

**Steps**:
1. Initialize Round #1 at T=0
2. Deposit at T=0 (epoch should be 1)
3. Deposit at T=2:00 (epoch should auto-advance to 2)
4. Deposit at T=4:00 (epoch should auto-advance to 3)
5. Deposit at T=4:30 → Should fail (epoch 3)

**Expected Results**:
- ✅ Epoch 1 → 2 at exactly 2:00
- ✅ Epoch 2 → 3 at exactly 4:00
- ✅ Deposits blocked after 4:00

---

### **Test 3: Auto-Winner Selection** ⭐ CRITICAL

**Objective**: Verify automatic finalization

**Steps**:
1. Initialize Round #1
2. 3 users deposit (30 tickets total)
3. Wait 6 minutes
4. **Critical**: Make deposit attempt, passing ALL 3 UserAccounts in remaining_accounts
5. Check round.is_complete = true
6. Check round.winner is one of the 3 users
7. Check round.winning_ticket is between 0-29

**Expected Results**:
- ✅ Winner found in remaining_accounts
- ✅ Winning ticket valid
- ✅ Round marked complete
- ✅ Prize amount set

---

### **Test 4: Multi-Round Claims** ⭐ CRITICAL

**Objective**: Verify ClaimTicket system allows multi-round claims

**Steps**:
1. Complete Round #1 → Winner = User A
2. Admin creates ClaimTicket for Round #1
3. Initialize Round #2
4. Users deposit in Round #2
5. **User A claims Round #1 prize** (while Round #2 active)
6. Complete Round #2 → Winner = User B
7. Admin creates ClaimTicket for Round #2
8. Initialize Round #3
9. **User B claims Round #2 prize** (while Round #3 active)
10. Verify both can claim independently

**Expected Results**:
- ✅ Round #1 winner claims while Round #2 runs
- ✅ Round #2 winner claims while Round #3 runs
- ✅ No blocking between rounds
- ✅ Each ClaimTicket independent

---

### **Test 5: Edge Case - 0 Tickets**

**Objective**: Verify round doesn't finalize with 0 tickets

**Steps**:
1. Initialize Round #1
2. Wait 6 minutes WITHOUT any deposits
3. Try to deposit after 6 minutes
4. Check round.is_complete = false (no finalization)

**Expected Results**:
- ✅ Round does NOT finalize (check line 140)
- ✅ Deposits still allowed
- ❌ No winner selected

---

### **Test 6: Edge Case - 1 Ticket**

**Objective**: Verify single-ticket round works

**Steps**:
1. Initialize Round #1
2. User A deposits 1 ticket
3. Wait 6 minutes
4. Make deposit attempt (with User A in remaining_accounts)
5. Verify winner = User A
6. Verify winning_ticket = 0

**Expected Results**:
- ✅ Winner selected correctly
- ✅ Ticket #0 wins
- ✅ No modulo errors

---

### **Test 7: Deposit Blocking**

**Objective**: Verify all deposit blocking scenarios

**Scenarios**:
1. Deposit in Epoch 3 → `DepositsClosedEpoch3`
2. Deposit in completed round → `RoundComplete`

**Expected Results**:
- ✅ Clear error messages
- ✅ State saved before error
- ✅ No state corruption

---

### **Test 8: Withdrawal & Claim Logic**

**Objective**: Verify losers vs winners

**Steps**:
1. Complete round with 3 participants
2. Winner tries process_withdrawal → `WinnerMustClaim`
3. Loser tries claim_prize → `NotWinner`
4. Winner claims prize → ✅
5. Loser withdraws stake → ✅

**Expected Results**:
- ✅ Winner cannot withdraw (must claim)
- ✅ Losers cannot claim (must withdraw)
- ✅ Clear error messages

---

### **Test 9: ClaimTicket Constraints**

**Objective**: Verify ClaimTicket security

**Scenarios**:
1. User tries to claim non-existent ClaimTicket → Account not found
2. User tries to claim someone else's ClaimTicket → `NotWinner`
3. User tries to claim twice → `AlreadyClaimed`
4. User tries to claim before round complete → `RoundNotComplete`

**Expected Results**:
- ✅ All constraints enforced
- ✅ No unauthorized claims

---

### **Test 10: Concurrent Deposits**

**Objective**: Verify ticket numbering under concurrency

**Steps**:
1. Send 3 deposits in same slot (if possible)
2. Verify ticket ranges don't overlap
3. Verify total_tickets_sold = sum of all tickets

**Expected Results**:
- ✅ Sequential ticket numbering
- ✅ No collisions (Solana account locking prevents this)

---

### **Test 11: Randomness Distribution**

**Objective**: Analyze winner distribution (manual inspection)

**Steps**:
1. Run 10 rounds with same ticket distribution
2. Record winners
3. Check if distribution seems reasonable

**Expected Results**:
- ⚠️ **Note**: Pseudo-random, expect some bias
- Document for VRF replacement

---

### **Test 12: Account Size & Rent**

**Objective**: Verify rent exemption

**Steps**:
1. Check each account's rent exemption
2. Verify protocol can pay out all claims
3. Try to drain protocol below rent minimum → `InsufficientFunds`

**Expected Results**:
- ✅ All accounts rent-exempt
- ✅ Cannot drain protocol
- ✅ Math correct (see CODE_REVIEW.md)

---

## 🔧 TEST HELPERS NEEDED

### Helper 1: Time Warp (for devnet testing)
```typescript
async function waitForEpochAdvance(epochDuration: number) {
  // For devnet: actually wait
  // For localnet: could use time-travel if available
  await sleep(epochDuration * 1000);
}
```

### Helper 2: Create Multiple Users
```typescript
function createTestUsers(count: number): Keypair[] {
  return Array(count).fill(null).map(() => Keypair.generate());
}
```

### Helper 3: Airdrop to Users
```typescript
async function fundUsers(users: Keypair[], amount: number) {
  for (const user of users) {
    await connection.requestAirdrop(user.publicKey, amount * LAMPORTS_PER_SOL);
  }
}
```

### Helper 4: Verify Round State
```typescript
async function verifyRoundState(
  roundId: number,
  expected: Partial<RoundState>
) {
  const round = await program.account.roundState.fetch(roundPDA);
  assert.equal(round.epochInRound, expected.epochInRound);
  assert.equal(round.isComplete, expected.isComplete);
  // ...
}
```

---

## 📊 SUCCESS CRITERIA

### **Must Pass (Blocking)**
- ✅ Test 1: Basic Round Lifecycle
- ✅ Test 2: Auto-Epoch Advancement
- ✅ Test 3: Auto-Winner Selection
- ✅ Test 4: Multi-Round Claims
- ✅ Test 7: Deposit Blocking
- ✅ Test 8: Withdrawal & Claim Logic

### **Should Pass (Important)**
- ✅ Test 5: Edge Case - 0 Tickets
- ✅ Test 6: Edge Case - 1 Ticket
- ✅ Test 9: ClaimTicket Constraints
- ✅ Test 12: Account Size & Rent

### **Nice to Have (Informational)**
- Test 10: Concurrent Deposits
- Test 11: Randomness Distribution

---

## 🚀 EXECUTION PLAN

### Phase 1: Unit Tests
- Mock time advancement
- Test individual functions
- Verify calculations

### Phase 2: Integration Tests (Devnet)
- **Critical**: Test 1-4 (core lifecycle)
- Deploy to devnet
- Run with actual time delays

### Phase 3: Stress Testing
- Multiple concurrent users
- Many rounds
- Edge cases

### Phase 4: Security Audit
- Code review (DONE ✅)
- Penetration testing
- Formal verification (optional)

---

## 📝 TEST EXECUTION LOG

### Pre-deployment Checklist:
- [ ] All critical tests pass
- [ ] Code review complete ✅
- [ ] Integration tests written
- [ ] Devnet deployment successful
- [ ] Lifecycle test successful
- [ ] Multi-round test successful

### Deployment Readiness:
- **Devnet**: Ready after integration tests pass
- **Mainnet**: Requires VRF integration + audit
