# Deployment & Initialization Guide

## Overview

This guide covers deploying and initializing the Circus Finance lottery protocol across different environments (localnet, devnet, mainnet).

## Quick Start (Devnet)

```bash
# 1. Make sure you have devnet SOL (get from faucet.solana.com)
solana config set --url devnet

# 2. Deploy the program
node scripts/deploy.js devnet

# 3. Initialize the protocol
node scripts/initialize.js devnet

# 4. Check status
node scripts/manage.js devnet status

# 5. Start frontend
cd ../../../
yarn dev
```

## Scripts Overview

### 1. `deploy.js` - Deployment Script

Handles building and deploying the program to any network.

**Usage:**
```bash
node scripts/deploy.js <environment>
```

**What it does:**
- Builds the program (`anchor build`)
- Verifies program ID matches configuration
- Deploys to specified network
- Copies IDL to frontend
- Saves deployment info

**Environments:** `localnet`, `devnet`, `mainnet`

### 2. `initialize.js` - Protocol Initialization

Initializes the protocol after deployment (one-time setup).

**Usage:**
```bash
node scripts/initialize.js <environment>
```

**What it does:**
- Calls `initialize(validator)` - Sets up ProtocolState PDA
- Calls `seed_prize(amount)` - Seeds initial prize pool
- Calls `init_round(1, epoch)` - Creates first round
- Saves initialization info

**Parameters from config:**
- `validator`: Validator address (or generates random for testing)
- `prizeSeedAmount`: Initial prize in SOL
- `initialRoundId`: First round ID (usually 1)

### 3. `manage.js` - Protocol Management

Admin tools for managing rounds and epochs.

**Usage:**
```bash
node scripts/manage.js <environment> <action> [params]
```

**Actions:**
- `status` - Display current protocol state
- `advance-epoch` - Move round to next epoch (1→2→3)
- `select-winner` - Select winner for current round
- `init-round <id>` - Create a new round

**Examples:**
```bash
# Check current state
node scripts/manage.js devnet status

# Advance from epoch 1 to 2
node scripts/manage.js devnet advance-epoch

# Select winner (after epoch 3)
node scripts/manage.js devnet select-winner

# Start round #2
node scripts/manage.js devnet init-round 2
```

## Configuration

### Environment Config (`config/environments.json`)

```json
{
  "devnet": {
    "network": "devnet",
    "rpcUrl": "https://api.devnet.solana.com",
    "programId": "3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1",
    "admin": "YOUR_ADMIN_PUBKEY",
    "validator": "VALIDATOR_PUBKEY_OR_PLACEHOLDER",
    "prizeSeedAmount": 0.1,
    "initialRoundId": 1,
    "testMode": true
  }
}
```

**Fields:**
- `network`: Solana cluster (localnet/devnet/mainnet-beta)
- `rpcUrl`: RPC endpoint
- `programId`: Deployed program address
- `admin`: Admin wallet (auto-detected from signer)
- `validator`: Validator for VRF (can be placeholder for testing)
- `prizeSeedAmount`: Initial prize in SOL
- `initialRoundId`: Starting round number
- `testMode`: Safety flag (prevents mainnet accidents)

## Complete Testing Flow

### Step 1: Deploy & Initialize
```bash
# Set network
solana config set --url devnet

# Get your address
solana address
# Output: 6LMkcE3itY24bmVFQksNmhiekaJBFBShPFZkroLFQcsg

# Get devnet SOL
# Visit https://faucet.solana.com

# Deploy
node scripts/deploy.js devnet

# Initialize
node scripts/initialize.js devnet
```

### Step 2: Test User Flow
```bash
# Check initial state
node scripts/manage.js devnet status

# (In another terminal or via frontend)
# User deposits 0.05 SOL
# This creates their UserAccount PDA automatically

# Take snapshots for epoch 1 (can be done via UI or script)
# In production, this would be automated or called by users

# Advance to epoch 2
node scripts/manage.js devnet advance-epoch

# Take epoch 2 snapshots

# Advance to epoch 3
node scripts/manage.js devnet advance-epoch

# Take epoch 3 snapshots

# Select winner
node scripts/manage.js devnet select-winner

# Check final state
node scripts/manage.js devnet status
```

### Step 3: Start New Round
```bash
# Initialize round #2
node scripts/manage.js devnet init-round 2

# Users can deposit again
# Repeat epoch cycle
```

## Frontend Integration

After deployment and initialization, update frontend config if needed:

**File:** `src/config/solana.ts`
```typescript
export const PROGRAM_ID = new PublicKey('3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1');
export const SOLANA_NETWORK = 'devnet' as WalletAdapterNetwork;
```

The IDL is automatically copied to `src/idl/rafa.json` during deployment.

## Mainnet Preparation

**⚠️ CRITICAL: Do NOT deploy current contract to mainnet!**

The contract is missing essential features:
- ❌ Prize distribution function
- ❌ Withdrawal processing
- ❌ Round finalization

**Before mainnet deployment:**
1. Add `distribute_prize()` function
2. Add `process_withdrawal()` function
3. Add `close_round()` function
4. Professional security audit
5. Multi-sig admin wallet
6. Emergency pause mechanism
7. Comprehensive testing on devnet
8. Update `config/environments.json` with mainnet settings

## Troubleshooting

### "Account not initialized"
- Run `node scripts/initialize.js <env>` first

### "Program ID mismatch"
- Check `config/environments.json` matches your keypair
- Regenerate keypair or update config

### "Insufficient funds"
- Get more SOL from faucet (devnet)
- Deployment needs ~2-3 SOL

### "Already initialized"
- Protocol can only be initialized once
- Use manage script for further operations

### Network mismatch (wallet)
- Ensure your wallet is on the correct network
- Phantom: Settings → Developer → Testnet Mode → Devnet

## Directory Structure

```
contract/circus/
├── config/
│   └── environments.json        # Network configurations
├── scripts/
│   ├── deploy.js                # Deployment script
│   ├── initialize.js            # Initialization script
│   └── manage.js                # Management utilities
├── deployments/                 # Deployment records
│   ├── devnet.json
│   └── devnet-init.json
└── DEPLOYMENT_README.md         # This file
```

## Useful Commands

```bash
# Check Solana CLI config
solana config get

# View program
solana program show <PROGRAM_ID> --url devnet

# View protocol state
solana account <PROTOCOL_PDA> --url devnet

# View in explorer
open "https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet"
```

## Next Steps

1. ✅ Deploy to devnet
2. ✅ Initialize protocol
3. ✅ Test via frontend
4. ✅ Complete full round flow
5. ⏳ Add missing functions (prize distribution, etc.)
6. ⏳ Security audit
7. ⏳ Mainnet deployment

## Support

If you encounter issues:
1. Check this README
2. Review `DEPLOYMENT_ANALYSIS.md` for contract details
3. Check deployment logs in `deployments/` directory
4. Verify network and wallet settings
