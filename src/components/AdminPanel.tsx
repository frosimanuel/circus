import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAdminFunctions } from '../hooks/useAdminFunctions';
import { useRaffleState } from '../hooks/useRaffleState';

/**
 * Admin Panel Component
 *
 * Allows admin to initialize protocol and manage rounds
 * Only shows if wallet is connected as admin
 */
export const AdminPanel: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { protocolState, roundState, loading } = useRaffleState();
  const {
    initializeProtocol,
    seedPrize,
    initializeRound,
    advanceEpoch,
    takeSnapshot,
    selectWinner,
    isProcessing,
    error,
    lastTx,
  } = useAdminFunctions();

  const [prizeAmount, setPrizeAmount] = useState('0.1');
  const [roundId, setRoundId] = useState('1');

  // Auto-update round ID suggestion when protocol state changes
  React.useEffect(() => {
    if (protocolState) {
      const nextId = protocolState.currentRound + 1;
      setRoundId(nextId.toString());
    }
  }, [protocolState]);

  const handleInitialize = async () => {
    const result = await initializeProtocol();
    if (result.success) {
      alert('Protocol initialized! TX: ' + result.signature);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleSeedPrize = async () => {
    const amount = parseFloat(prizeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const result = await seedPrize(amount);
    if (result.success) {
      alert(`Prize seeded with ${amount} SOL! TX: ${result.signature}`);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleInitRound = async () => {
    const id = parseInt(roundId);
    if (isNaN(id) || id <= 0) {
      alert('Please enter a valid round ID');
      return;
    }

    const result = await initializeRound(id);
    if (result.success) {
      alert(`Round #${id} initialized! TX: ${result.signature}`);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleAdvanceEpoch = async () => {
    if (!window.confirm('Are you sure you want to advance to the next epoch?')) {
      return;
    }

    const result = await advanceEpoch();
    if (result.success) {
      alert(`Epoch advanced successfully! TX: ${result.signature}`);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleTakeSnapshot = async () => {
    const result = await takeSnapshot();
    if (result.success) {
      alert(`Snapshot taken successfully! TX: ${result.signature}\n\nYou can now select a winner.`);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const handleSelectWinner = async () => {
    if (!window.confirm('Are you sure you want to select a winner and end this round?')) {
      return;
    }

    const result = await selectWinner();
    if (result.success) {
      alert(`Winner selected! TX: ${result.signature}\n\nCheck the Staking Raffle page to see the results.`);
    } else {
      alert('Error: ' + result.error);
    }
  };

  const isProtocolInitialized = protocolState !== null;
  const nextRoundId = protocolState ? protocolState.currentRound + 1 : 1;
  const isRoundComplete = roundState?.isComplete || false;

  return (
    <div style={{
      maxWidth: '800px',
      margin: '40px auto',
      padding: '30px',
      background: '#1a1a2e',
      borderRadius: '12px',
      border: '2px solid #ff6b6b',
      color: 'white',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>🎮 Admin Panel</h1>

      {!connected ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Connect your wallet to use admin functions</p>
          <WalletMultiButton />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '30px', padding: '15px', background: '#16213e', borderRadius: '8px' }}>
            <h3>Protocol Status</h3>
            {loading ? (
              <p>Loading...</p>
            ) : isProtocolInitialized ? (
              <div>
                <p>✅ Protocol Initialized</p>
                <p>Current Round: {protocolState?.currentRound || 'N/A'}</p>
                <p>Prize Seed: {protocolState ? (protocolState.prizeSeedAmount / 1e9).toFixed(3) : '0'} SOL</p>
              </div>
            ) : (
              <p>⚠️ Protocol Not Initialized</p>
            )}
          </div>

          {!isProtocolInitialized && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#0f3460', borderRadius: '8px' }}>
              <h3>1. Initialize Protocol</h3>
              <p style={{ fontSize: '14px', color: '#ccc' }}>
                First step: Initialize the protocol contract
              </p>
              <button
                onClick={handleInitialize}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  background: '#ff6b6b',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  marginTop: '10px'
                }}
              >
                {isProcessing ? 'Processing...' : 'Initialize Protocol'}
              </button>
            </div>
          )}

          {isProtocolInitialized && (
            <>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#0f3460', borderRadius: '8px' }}>
                <h3>2. Seed Prize Pool</h3>
                <p style={{ fontSize: '14px', color: '#ccc' }}>
                  Add SOL to the prize pool
                </p>
                <input
                  type="number"
                  value={prizeAmount}
                  onChange={(e) => setPrizeAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    marginRight: '10px',
                    width: '120px'
                  }}
                />
                <span style={{ marginRight: '10px' }}>SOL</span>
                <button
                  onClick={handleSeedPrize}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    background: '#4ecdc4',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Seed Prize'}
                </button>
              </div>

              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: isRoundComplete ? '#1a4d2e' : '#0f3460',
                borderRadius: '8px',
                border: isRoundComplete ? '2px solid #4ecdc4' : 'none'
              }}>
                <h3>3. Initialize New Round {isRoundComplete && '⚡'}</h3>
                {isRoundComplete && (
                  <p style={{ fontSize: '12px', color: '#4ecdc4', fontWeight: 'bold', marginTop: '5px' }}>
                    ✅ Round #{protocolState?.currentRound} is complete! Initialize Round #{nextRoundId} to continue.
                  </p>
                )}
                <p style={{ fontSize: '14px', color: '#ccc', marginTop: '10px' }}>
                  Next round: #{nextRoundId}
                </p>
                <input
                  type="number"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  min="1"
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    marginRight: '10px',
                    width: '80px'
                  }}
                />
                <button
                  onClick={handleInitRound}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    background: '#f38181',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Initialize Round'}
                </button>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', background: '#0f3460', borderRadius: '8px' }}>
                <h3>4. Advance Epoch</h3>
                <p style={{ fontSize: '14px', color: '#ccc' }}>
                  Move to the next epoch (1 → 2 → 3)
                </p>
                <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>
                  ⚠️ Use this when epoch timer expires
                </p>
                <button
                  onClick={handleAdvanceEpoch}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    background: '#ff6b6b',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginTop: '10px'
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Advance Epoch'}
                </button>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', background: '#0f3460', borderRadius: '8px' }}>
                <h3>5. Take Snapshot</h3>
                <p style={{ fontSize: '14px', color: '#ccc' }}>
                  Record participant balances for winner selection
                </p>
                <p style={{ fontSize: '12px', color: '#4ecdc4', marginTop: '5px' }}>
                  📸 Do this BEFORE selecting winner
                </p>
                <button
                  onClick={handleTakeSnapshot}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    background: '#4ecdc4',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginTop: '10px'
                  }}
                >
                  {isProcessing ? 'Processing...' : '📸 Take Snapshot'}
                </button>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', background: '#0f3460', borderRadius: '8px' }}>
                <h3>6. Select Winner</h3>
                <p style={{ fontSize: '14px', color: '#ccc' }}>
                  Draw a random winner and complete the round
                </p>
                <p style={{ fontSize: '12px', color: '#FFD700', marginTop: '5px' }}>
                  🎰 Use this AFTER taking snapshot
                </p>
                <button
                  onClick={handleSelectWinner}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#000',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginTop: '10px'
                  }}
                >
                  {isProcessing ? 'Processing...' : '🎲 Select Winner'}
                </button>
              </div>
            </>
          )}

          {error && (
            <div style={{ padding: '15px', background: '#d32f2f', borderRadius: '8px', marginTop: '20px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {lastTx && (
            <div style={{ padding: '15px', background: '#2e7d32', borderRadius: '8px', marginTop: '20px' }}>
              <strong>Success!</strong> <br />
              TX: {lastTx.substring(0, 20)}...
              <br />
              <a
                href={`https://explorer.solana.com/tx/${lastTx}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#a5d6a7' }}
              >
                View on Explorer
              </a>
            </div>
          )}

          <div style={{ marginTop: '30px', padding: '15px', background: '#16213e', borderRadius: '8px' }}>
            <h3>📝 Instructions</h3>
            <ol style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <li>Initialize Protocol (first time only)</li>
              <li>Seed Prize Pool with some SOL</li>
              <li>Initialize Round #1</li>
              <li>Go to Staking Raffle and make deposits</li>
              <li>Use test commands to advance epochs and select winner</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
