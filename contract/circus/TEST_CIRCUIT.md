# Devnet Circuit Testing Guide

Since the TypeScript script has type compatibility issues with the latest Anchor version, here are simple manual commands to test the complete lottery circuit on devnet.

## Prerequisites
- Program deployed to devnet ✅
- Wallet has devnet SOL  ✅
- Frontend running on http://localhost:5174/ ✅

## Option 1: Use Existing Tests (Recommended)

The existing test file already has a complete flow test. Run it:

```bash
cd /Users/maruzza/Desktop/Proyect/Circus-front/contract/circus
anchor test --skip-local-validator
```

This will:
1. Initialize protocol (if needed)
2. Seed prize pool
3. Create multiple rounds
4. Simulate deposits from multiple users
5. Run through all 3 epochs
6. Select winners

**Note**: The tests run on devnet when you use `--skip-local-validator`

## Option 2: Frontend Testing (Simplest)

The best way to test is directly through the frontend:

### WIN Scenario (You're the only participant)
1. Open http://localhost:5174/
2. Connect your wallet (make sure it's set to DEVNET)
3. Navigate to "Staking Raffle" game
4. Make a deposit (e.g., 0.05 SOL)
5. Wait for auto-refresh or manually refresh
6. You should see:
   - Your balance
   - Current epoch
   - Round state

### To Complete a Full Round
You'll need admin access to advance epochs and select winner. Currently only the admin wallet (`6LMkcE3itY24bmVFQksNmhiekaJBFBShPFZkroLFQcsg`) can do this.

**Admin commands** (from CLI):

```bash
# Make sure you're on devnet
solana config set --url devnet

# Use Anchor CLI to call admin functions
# (You'll need to create a script or use the test file)
```

## Option 3: Quick Manual Test via Solana Playground

1. Go to https://beta.solpg.io/
2. Import your program
3. Use the UI to call functions in order:
   - `initialize` (if needed)
   - `seed_prize`
   - `init_round`
   - `deposit` (as yourself)
   - `take_snapshot_batch` (epoch 1)
   - `advance_epoch`
   - `take_snapshot_batch` (epoch 2)
   - `advance_epoch`
   - `take_snapshot_batch` (epoch 3)
   - `select_winner_local`

## Current State

Your program is deployed and ready at:
- **Program ID**: `3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1`
- **Network**: Devnet
- **Explorer**: https://explorer.solana.com/address/3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1?cluster=devnet

## Frontend Integration Status

The frontend is already configured for devnet and will:
- Auto-connect to devnet RPC
- Fetch protocol state every 5 seconds
- Display your balance and round information
- Allow deposits through the UI

## Next Steps

1. **Connect wallet to frontend** and verify it shows the correct network
2. **Make a test deposit** to see if the transaction goes through
3. **Check the browser console** for any errors
4. **Verify the state updates** after your deposit

If you want to test the full win/lose scenarios, we can:
1. Add admin functions to the frontend UI, OR
2. Create a simpler Node.js script that doesn't rely on TypeScript type checking, OR
3. Just manually use the Anchor test commands which already work

Let me know which approach you prefer!
