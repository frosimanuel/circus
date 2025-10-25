import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import type { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Program ID from your deployed contract
export const PROGRAM_ID = new PublicKey('AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi');

// Network configuration - change this for different environments
// 'localnet' for local testing with solana-test-validator
// 'devnet' for Solana devnet
// 'mainnet-beta' for production
export const SOLANA_NETWORK = 'devnet' as WalletAdapterNetwork;

// RPC endpoint configuration
export const getRpcEndpoint = (): string => {
  return clusterApiUrl(SOLANA_NETWORK);
};

// Create connection instance
export const getConnection = () => {
  return new Connection(getRpcEndpoint(), {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
};

// Helper to derive Protocol State PDA
export const getProtocolStatePDA = (): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
};

// Helper to derive User Account PDA
export const getUserAccountPDA = (userPubkey: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
};

// Helper to derive Round State PDA
export const getRoundStatePDA = (protocolStatePDA: PublicKey, roundId: number | import('@coral-xyz/anchor').BN): [PublicKey, number] => {
  const roundIdBuffer = Buffer.alloc(8);
  const roundIdNum = typeof roundId === 'number' ? roundId : roundId.toNumber();
  roundIdBuffer.writeBigUInt64LE(BigInt(roundIdNum));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('round'), protocolStatePDA.toBuffer(), roundIdBuffer],
    PROGRAM_ID
  );
};

// Helper to derive ClaimTicket PDA
export const getClaimTicketPDA = (roundId: number, winnerPubkey: PublicKey): [PublicKey, number] => {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('claim'), roundIdBuffer, winnerPubkey.toBuffer()],
    PROGRAM_ID
  );
};
