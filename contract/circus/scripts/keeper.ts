import 'dotenv/config';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

async function main() {
  const rpcUrl = process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

  const epochInfo = await connection.getEpochInfo();
  console.log('epochInfo', epochInfo);

  // Example stake accounts to query inflation rewards; replace with real stake account addresses
  const stakeAccounts: PublicKey[] = (process.env.STAKE_ACCOUNTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new PublicKey(s));

  if (stakeAccounts.length > 0) {
    // Using getInflationReward per docs: https://solana.com/es/docs/rpc/http/getinflationreward
    const rewards = await connection.getInflationReward(
      stakeAccounts,
      epochInfo.epoch,
      'finalized'
    );
    console.log('inflation rewards for epoch', epochInfo.epoch, rewards);
  } else {
    console.log('No STAKE_ACCOUNTS provided; skipping getInflationReward');
  }

  // Note: In future, we can load the on-chain program to discover the current round's stake account PDA.
  // For now, we depend on STAKE_ACCOUNTS env to stay validator-driven only.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


