# 🎮 Quick Start Guide - Circus Finance Lottery

## ✅ What's Done

Your protocol is **LIVE on Devnet** and ready to test!

### Deployed & Initialized:
- **Program ID**: `3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1`
- **Protocol PDA**: `AfsVmPQZKpv7ps3vbjXFi6LC8DhB1Aym3qE4yY3ewUBP`
- **Current Round**: #1 (Epoch 1/3)
- **Prize Pool**: 0.1 SOL seeded
- **Admin**: `6LMkcE3itY24bmVFQksNmhiekaJBFBShPFZkroLFQcsg`

### Explorer Links:
- [Protocol State](https://explorer.solana.com/address/AfsVmPQZKpv7ps3vbjXFi6LC8DhB1Aym3qE4yY3ewUBP?cluster=devnet)
- [Round #1](https://explorer.solana.com/address/Dw7EbahsqnZaZnNRkS2tk8WYfFZvyWtRUhs8TXfp6Arj?cluster=devnet)

## 🎯 Test the Protocol Now!

### Option 1: Via Frontend (Recommended)

1. **Switch your wallet to DEVNET** (Phantom: Settings → Developer → Testnet Mode → Devnet)

2. **Open the app**: http://localhost:5174/

3. **Connect your wallet**

4. **Navigate to Staking Raffle**

5. **Make a deposit** (try 0.05 SOL)

6. **Check your balance** - should appear in the UI

### Option 2: Via CLI Scripts

```bash
# Check current status
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet status

# Advance to epoch 2
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet advance-epoch

# Advance to epoch 3
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet advance-epoch

# Select winner
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet select-winner
```

## 📁 Files Created

### Configuration & Scripts:
- `config/environments.json` - Environment configurations (devnet/mainnet)
- `scripts/deploy.js` - Deployment automation
- `scripts/initialize.js` - Protocol initialization
- `scripts/manage.js` - Round & epoch management

### Documentation:
- `DEPLOYMENT_ANALYSIS.md` - Contract review & production readiness
- `DEPLOYMENT_README.md` - Full deployment guide
- `QUICK_START.md` - This file!

### Frontend Integration:
- `src/hooks/useAdminFunctions.ts` - Admin functions hook
- `src/components/AdminPanel.tsx` - Admin UI
- `src/config/solana.ts` - Already configured for devnet

## 🔄 Complete Testing Flow

### 1. User Deposits (Epoch 1)
```
- User opens frontend
- Clicks "Deposit"
- Enters amount (e.g., 0.05 SOL)
- Confirms transaction
→ UserAccount PDA created automatically
→ Balance tracked in protocol
```

### 2. Admin Advances Epochs
```bash
# Move to Epoch 2
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet advance-epoch

# Move to Epoch 3
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet advance-epoch
```

### 3. Select Winner
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet select-winner
```

### 4. Start New Round
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
  node scripts/manage.js devnet init-round 2
```

## ⚠️ Important Notes

### For Testing (Current State):
✅ Protocol is fully functional for testing
✅ Users can deposit
✅ Epochs can be advanced
✅ Winners can be selected
✅ Perfect for UI/UX development

### Before Mainnet:
❌ **DO NOT deploy to mainnet yet!**

Missing critical features:
1. Prize distribution function (winners can't claim!)
2. Withdrawal processing (users can't get funds back!)
3. Round finalization

See `DEPLOYMENT_ANALYSIS.md` for full details.

## 🐛 Troubleshooting

### "Transaction failed: AccountNotInitialized"
→ **Fixed!** Protocol is now initialized.

### "Network mismatch"
→ Switch your wallet to devnet (Settings → Developer → Testnet Mode)

### Frontend not connecting
→ Refresh the page at http://localhost:5174/
→ Make sure dev server is running (`yarn dev` in root)

### Can't find program on devnet
→ Check explorer link above, program is deployed and working

## 📊 Current State Summary

| Item | Status | Value |
|------|--------|-------|
| Program Deployed | ✅ | devnet |
| Protocol Initialized | ✅ | Yes |
| Prize Pool Seeded | ✅ | 0.1 SOL |
| Current Round | ✅ | #1 |
| Current Epoch | ✅ | 1/3 |
| Frontend Running | ✅ | localhost:5174 |
| Ready for Testing | ✅ | YES! |

## 🚀 Next Steps

1. **Test deposits via frontend** - Make sure UI updates correctly
2. **Advance epochs manually** - Use manage script
3. **Select a winner** - Test winner selection flow
4. **Add prize distribution** - Implement `distribute_prize()` function
5. **Add withdrawal processing** - Implement `process_withdrawal()` function
6. **Production deployment** - After adding missing features

## 📞 Need Help?

Check these files:
- `DEPLOYMENT_README.md` - Full deployment guide
- `DEPLOYMENT_ANALYSIS.md` - Contract analysis
- `TEST_CIRCUIT.md` - Testing strategies

---

**You're all set! Start testing at http://localhost:5174/** 🎮
