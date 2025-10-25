# Fully Autonomous Raffle System

## Overview

The raffle system is now **completely autonomous** - no manual intervention needed for epoch advancement, winner selection, or round initialization.

## How It Works

### Auto-Crank System (`useAutoCrank` hook)

The system runs background checks every **10 seconds** to:

1. **Advance Epochs** (every 2 minutes)
   - Automatically moves from Epoch 1 → 2 → 3
   - No user interaction needed

2. **Select Winner** (after 6 minutes)
   - Automatically finalizes round when Epoch 3 ends
   - Selects winner using on-chain randomness
   - Winner screen appears immediately

3. **Initialize Next Round** (admin only)
   - If admin wallet is connected, automatically starts next round
   - Waits 60 seconds after round completion before initializing
   - New round starts seamlessly

## Timeline

```
0:00 - Round #N starts (Epoch 1)
     - Users can buy tickets

2:00 - Auto-advance to Epoch 2
     - Users can still buy tickets

4:00 - Auto-advance to Epoch 3
     - Deposits close automatically
     - "DRAWING WINNER" message shows

6:00 - Auto-finalize & select winner
     - Winner screen displays
     - Losers can withdraw refunds

6:00+ - Auto-initialize Round #N+1 (if admin connected)
      - New round starts automatically
      - Cycle repeats
```

## User Experience

### For Regular Users

**During Active Epochs:**
- See countdown timer
- Can buy tickets normally

**When Epoch Expires:**
- See: "⚡ AUTO-ADVANCING EPOCH..." (green, pulsing)
- Wait ~10 seconds for auto-advancement

**During Finalization (Epoch 3):**
- See: "🎲 DRAWING WINNER - ⚡ Selecting winner automatically..."
- Wait ~10 seconds for winner selection

**After Round Completes:**
- Winners: See prize breakdown and claim button
- Losers: See refund button
- Spectators: See "⚡ ROUND #X STARTING AUTOMATICALLY..."

### For Admin Users

If your wallet is the admin:
- New rounds start automatically after previous round completes
- No need to go to Admin Panel
- System runs completely hands-off

If you want to manually initialize:
- Go to Admin Panel
- Click "Initialize New Round"
- Enter next round ID

## Technical Details

### Polling Frequency
- Checks every **10 seconds**
- Throttles crank calls to minimum **30 seconds** apart
- Throttles round init to minimum **60 seconds** apart

### Safety Features
- Won't spam the network (throttling)
- Won't call if transaction already processing
- Handles errors gracefully with console logging
- Auto-refreshes state after successful operations

### Smart Detection

The system knows when to act by:
1. Calculating elapsed time since round start
2. Comparing expected epoch vs current epoch
3. Checking if Epoch 3 has ended
4. Verifying if round is complete and ready for new round

### Admin Detection

For auto-initialization:
1. Fetches protocol state
2. Compares admin pubkey with connected wallet
3. Only initializes if wallet is admin
4. Shows "starting automatically" message to all users

## Console Logging

Watch the browser console for:

```
🔄 Auto-crank triggered: { shouldAdvanceEpoch: true, ... }
✅ Auto-crank successful: <signature>
🔄 Auto-initializing new round: 3
✅ New round initialized: <signature>
```

## What Changed

**Before:**
- Manual "ADVANCE EPOCH" buttons
- Manual "FINALIZE ROUND" buttons
- Manual round initialization required
- Required user action at each step

**After:**
- Everything happens automatically
- Users just watch timers count down
- Smooth, automated transitions
- Continuous operation

## Benefits

1. **Better UX**: No button clicking needed, just watch the countdown
2. **Always Active**: Rounds continue automatically
3. **Decentralized**: Anyone can run the frontend and help advance epochs (not just admin)
4. **Reliable**: No risk of rounds getting "stuck"
5. **Permissionless Advancement**: The `crank()` instruction can be called by anyone
6. **Admin Convenience**: Set it and forget it

## Edge Cases Handled

- **No admin connected**: Rounds complete but don't auto-initialize (anyone can manually init)
- **Multiple tabs open**: Only one will successfully call crank (others will see "already processing")
- **Network issues**: Retries on next check interval (10 seconds)
- **Zero tickets sold**: Won't finalize (needs at least 1 ticket)

## Future Improvements

Possible enhancements:
- Add visual progress bar for epoch advancement
- Show estimated time until next action
- Add sound effects for epoch transitions
- Display recent round history
- Show live participant count updates

---

**The raffle is now a fully autonomous, self-running system! 🎉**

Just connect your wallet, buy tickets, and watch the magic happen automatically.
