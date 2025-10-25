import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useRaffleState } from '../../hooks/useRaffleState';
import { useRaffleTransactions } from '../../hooks/useRaffleTransactions';
import { useParticipantCount } from '../../hooks/useParticipantCount';
import { useAutoCrank } from '../../hooks/useAutoCrank';
import { formatTicketRange, getTicketCount, hasTickets } from '../../utils/tickets';
import './StakingRaffle.css';

interface StakingRaffleProps {
  onBack: () => void;
}

type EpochStatus = 'Active' | 'Ended' | 'Completed';

export const StakingRaffle: React.FC<StakingRaffleProps> = ({ onBack }) => {
  const { publicKey, connected } = useWallet();
  const { roundState, userAccount, loading, error: stateError, isReady, refresh } = useRaffleState();
  const { deposit, createClaimTicket, claimPrize, processWithdrawal, callCrank, isProcessing, error: txError } = useRaffleTransactions();
  const { participantCount } = useParticipantCount(roundState?.roundId || null);

  // Fully automatic state machine - epochs advance and winners drawn based on time
  useAutoCrank();

  const [blinkOn, setBlinkOn] = useState(true);
  const [ticketsToBuy, setTicketsToBuy] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Show wallet modal when not connected
  useEffect(() => {
    if (!connected) {
      setShowWalletModal(true);
    } else {
      setShowWalletModal(false);
    }
  }, [connected]);

  // Modal states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchasedTicketNumbers, setPurchasedTicketNumbers] = useState('');

  // Derived state from blockchain
  const epochId = roundState?.roundId || 0;
  const currentEpochInRound = roundState?.epochInRound || 0;

  // Determine epoch status from blockchain data
  // Check if user has a stake in the completed round
  const userHasStakeInCompletedRound = roundState?.isComplete &&
    userAccount &&
    userAccount.roundJoined === epochId &&
    (userAccount.balance > 0 || userAccount.pendingWithdrawalAmount > 0);

  // Determine status: Check isComplete FIRST, then check epoch number
  const epochStatus: EpochStatus = roundState?.isComplete
    ? 'Completed'  // Round is complete (winner selected)
    : currentEpochInRound >= 3
      ? 'Ended'    // Epoch 3 reached, waiting for winner selection
      : 'Active';  // Still in epoch 1 or 2

  // Real countdown timer based on blockchain data
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Calculate time remaining until current epoch ends
  useEffect(() => {
    if (!roundState || !roundState.startEpoch || roundState.epochInRound === 0) {
      setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const calculateTimeRemaining = () => {
      const now = Date.now(); // Current timestamp in milliseconds
      const startEpoch = roundState.startEpoch; // Round start time in milliseconds
      const currentEpoch = roundState.epochInRound; // Current epoch: 1, 2, or 3

      // Calculate when current epoch ends
      // Epoch 1 ends at: startEpoch + (1 * 120 * 1000)
      // Epoch 2 ends at: startEpoch + (2 * 120 * 1000)
      // Epoch 3 ends at: startEpoch + (3 * 120 * 1000)
      const epochEndTime = startEpoch + (currentEpoch * EPOCH_DURATION_SECONDS * 1000);
      const msRemaining = Math.max(0, epochEndTime - now);
      const secondsRemaining = Math.floor(msRemaining / 1000);

      const hours = Math.floor(secondsRemaining / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      console.log('⏱️ Timer Debug:', {
        now: new Date(now).toISOString(),
        startEpoch: new Date(startEpoch).toISOString(),
        currentEpoch,
        epochEndTime: new Date(epochEndTime).toISOString(),
        msRemaining,
        secondsRemaining,
        formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
        isExpired: msRemaining === 0
      });

      return { hours, minutes, seconds };
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [roundState]);

  // Real data from blockchain
  const accruedInterest = roundState ? roundState.totalPrizeLamports / LAMPORTS_PER_SOL : 0;
  const totalTicketsSold = roundState?.totalTicketsSold || 0;

  // Real participant count from blockchain
  const totalStaked = totalTicketsSold * 0.01; // Each ticket = 0.01 SOL
  const totalParticipants = participantCount;

  // Debug: Log statistics
  useEffect(() => {
    if (roundState) {
      console.log('📊 Pool Statistics:', {
        totalPrizeLamports: roundState.totalPrizeLamports,
        accruedInterest,
        totalTicketsSold,
        totalStaked,
        totalParticipants,
        roundId: roundState.roundId,
        epochInRound: roundState.epochInRound,
        isComplete: roundState.isComplete
      });
    }
  }, [roundState, accruedInterest, totalTicketsSold, totalStaked, totalParticipants]);

  // User's staked amount (their balance)
  const userStakeSOL = userAccount ? userAccount.balance / LAMPORTS_PER_SOL : 0;
  const userWon = roundState?.winner === publicKey?.toString();

  // User's ticket information
  const userHasTickets = userAccount ? hasTickets(userAccount.ticketStart, userAccount.ticketEnd) : false;
  const userTicketRange = userAccount && userHasTickets
    ? formatTicketRange(userAccount.ticketStart, userAccount.ticketEnd)
    : null;
  const userTicketCount = userAccount && userHasTickets
    ? getTicketCount(userAccount.ticketStart, userAccount.ticketEnd)
    : 0;

  // Debug: Log user account info
  useEffect(() => {
    if (connected && userAccount) {
      console.log('👤 User Account:', {
        balance: userAccount.balance,
        balanceSOL: userStakeSOL,
        ticketStart: userAccount.ticketStart,
        ticketEnd: userAccount.ticketEnd,
        ticketCount: userTicketCount,
        ticketRange: userTicketRange,
        roundJoined: userAccount.roundJoined,
        hasTickets: userHasTickets
      });
    } else if (connected) {
      console.log('👤 User Account: Not created yet (no deposits)');
    }
  }, [userAccount, connected, userStakeSOL, userTicketCount, userTicketRange, userHasTickets]);

  // Get winning ticket from blockchain
  const winningTicket = roundState?.winningTicket !== undefined ? roundState.winningTicket.toString() : 'N/A';
  const randomNumber = roundState?.winner ? roundState.winner.slice(0, 8) + '...' : '0x000...';

  // Constants
  const EPOCH_DURATION_SECONDS = 120; // 2 minutes per epoch (matches contract)

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkOn(prev => !prev);
    }, 500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Countdown animation (mock)
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => {
        let { hours, minutes, seconds } = prev;

        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              hours = 0;
              minutes = 0;
              seconds = 0;
            }
          }
        }

        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onBack();
    }
  };

  const formatNumber = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  const formatLargeNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  const handleTicketsChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= 9999) {
      setTicketsToBuy(num);
    }
  };

  const calculateTotal = () => {
    return ticketsToBuy * 0.01; // Each ticket costs 0.01 SOL
  };

  // Calculate which ticket numbers the user will receive
  const getNextTicketNumbers = () => {
    const startTicket = totalTicketsSold;
    const endTicket = totalTicketsSold + ticketsToBuy - 1;

    if (ticketsToBuy === 1) {
      return `#${formatLargeNumber(startTicket)}`;
    } else {
      return `#${formatLargeNumber(startTicket)} - #${formatLargeNumber(endTicket)}`;
    }
  };

  const getStatusColor = () => {
    switch (epochStatus) {
      case 'Active': return '#00FF88';
      case 'Ended': return '#FFD700';
      case 'Completed': return '#FF0066';
      default: return '#FFFFFF';
    }
  };

  // Check if deposits are allowed (only in Epochs 1-2)
  const canDeposit = currentEpochInRound < 3 && epochStatus === 'Active' && !roundState?.isComplete;

  const handleBuyClick = () => {
    if (!canDeposit) {
      alert('Deposits are closed. Please wait for the next round!');
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmPurchase = async () => {
    setShowConfirmation(false);

    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    // Save the ticket numbers BEFORE the deposit
    setPurchasedTicketNumbers(getNextTicketNumbers());

    // Call the deposit transaction (convert tickets to SOL)
    const solAmount = ticketsToBuy * 0.01;
    const result = await deposit(solAmount);

    if (result.success) {
      setShowSuccess(true);
      console.log('Deposit successful! Signature:', result.signature);
    } else {
      alert(`Transaction failed: ${result.error}`);
    }
  };

  const handleCancelPurchase = () => {
    setShowConfirmation(false);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setTicketsToBuy(1); // Reset input
  };

  return (
    <div className="staking-raffle-screen" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Background with CRT effects */}
      <div className="raffle-bg">
        <div className="raffle-scanlines"></div>
        <div className="raffle-stars"></div>
      </div>

      {/* Main Content */}
      <div className="raffle-content">

        {/* Header with Epoch Info */}
        <div className="raffle-header">
          <div className="epoch-info-display">
            <div className="epoch-number">
              ROUND #{epochId} • EPOCH {currentEpochInRound}/3
            </div>
            <div className="epoch-status" style={{ color: getStatusColor() }}>
              ● {epochStatus.toUpperCase()}
            </div>
          </div>

          <div className="raffle-title">
            <h1>TICKET LOTTERY</h1>
            <p className="raffle-subtitle">BUY TICKETS • WIN THE POOL • WINNER TAKES ALL</p>
          </div>

          <div className="prize-pool-display">
            <div className="prize-label">TOTAL PRIZE POOL</div>
            <div className="prize-amount">{accruedInterest.toFixed(2)} SOL</div>
            <div className="prize-sublabel">WINNER GETS: YOUR TICKETS + PRIZE</div>
          </div>
        </div>

        {/* Wallet Connection Section */}
        <div className="wallet-section" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          gap: '15px'
        }}>
          <WalletMultiButton />
          {!connected && (
            <div style={{ color: '#FF0066', fontFamily: '"Press Start 2P", monospace', fontSize: '12px' }}>
              ⚠️ CONNECT WALLET TO PLAY
            </div>
          )}
          {connected && loading && (
            <div style={{ color: '#00FF88', fontFamily: '"Press Start 2P", monospace', fontSize: '12px' }}>
              ⏳ LOADING...
            </div>
          )}
          {stateError && (
            <div style={{ color: '#FF0066', fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}>
              ERROR: {stateError}
            </div>
          )}
        </div>

        {/* Countdown Timer */}
        <div className="countdown-section">
          <div className="countdown-label">
            {epochStatus === 'Active'
              ? `EPOCH ${currentEpochInRound} ENDS IN`
              : epochStatus === 'Ended'
                ? 'WAITING FOR WINNER SELECTION'
                : 'ROUND COMPLETE'}
          </div>
          <div className="countdown-timer">
            <div className="time-segment">
              <div className="time-digit">{formatNumber(timeRemaining.hours)}</div>
              <div className="time-unit">HOURS</div>
            </div>
            <div className="time-separator">:</div>
            <div className="time-segment">
              <div className="time-digit">{formatNumber(timeRemaining.minutes)}</div>
              <div className="time-unit">MINUTES</div>
            </div>
            <div className="time-separator">:</div>
            <div className="time-segment">
              <div className="time-digit">{formatNumber(timeRemaining.seconds)}</div>
              <div className="time-unit">SECONDS</div>
            </div>
          </div>
          {timeRemaining.hours === 0 && timeRemaining.minutes === 0 && timeRemaining.seconds === 0 && epochStatus === 'Active' && (
            <div style={{
              marginTop: '15px',
              textAlign: 'center'
            }}>
              <div style={{
                color: '#00FF88',
                fontSize: '10px',
                marginBottom: '5px',
                fontFamily: '"Press Start 2P", monospace',
                animation: 'pulse 2s infinite',
              }}>
                ⚡ AUTO-ADVANCING EPOCH {currentEpochInRound}...
              </div>
              <div style={{ color: '#AAA', fontSize: '9px' }}>
                Please approve the transaction to continue
              </div>
            </div>
          )}
        </div>

        {/* Status Banner for Ended Epoch */}
        {epochStatus === 'Ended' && (
          <div className="status-banner ended-banner">
            <div className="banner-icon">🎲</div>
            <div className="banner-content">
              <div className="banner-title">DRAWING WINNER</div>
              <div className="banner-subtitle" style={{
                fontSize: '14px',
                marginTop: '10px',
                color: '#00FF88',
                animation: 'pulse 2s infinite',
              }}>
                ⚡ Selecting winner automatically...
              </div>
              <div style={{ color: '#AAA', fontSize: '11px', marginTop: '10px' }}>
                Please approve the transaction to continue
              </div>
            </div>
          </div>
        )}

        {/* Results Screen - Shown when epoch is Completed */}
        {epochStatus === 'Completed' ? (
          <div className="results-screen">
            {userHasStakeInCompletedRound && userWon ? (
              // Winner View
              <div className="result-container winner">
                <div className="result-icon">🎉</div>
                <div className="result-title">CONGRATULATIONS!</div>
                <div className="result-subtitle">YOU WON THE LOTTERY!</div>

                <div className="prize-breakdown">
                  <div className="breakdown-row">
                    <span className="breakdown-label">Your Stake</span>
                    <span className="breakdown-value">{userStakeSOL.toFixed(4)} SOL</span>
                  </div>
                  <div className="breakdown-row">
                    <span className="breakdown-label">Prize Pool Won</span>
                    <span className="breakdown-value highlight">+{accruedInterest.toFixed(4)} SOL</span>
                  </div>
                  <div className="breakdown-divider"></div>
                  <div className="breakdown-row main">
                    <span className="breakdown-label">TOTAL PAYOUT</span>
                    <span className="breakdown-value">{(userStakeSOL + accruedInterest).toFixed(4)} SOL</span>
                  </div>
                </div>

                <div className="winning-details">
                  <div className="detail-card">
                    <div className="detail-label">WINNING TICKET</div>
                    <div className="detail-value">#{winningTicket}</div>
                  </div>
                  <div className="detail-card">
                    <div className="detail-label">RANDOM NUMBER</div>
                    <div className="detail-value">{randomNumber}</div>
                  </div>
                </div>

                <button
                  className="result-action-button winner-button"
                  onClick={async () => {
                    // Two-step process: Create claim ticket, then claim
                    console.log('Starting claim process...');

                    // Step 1: Create claim ticket
                    console.log('Step 1: Creating claim ticket...');
                    const createResult = await createClaimTicket();
                    if (!createResult.success) {
                      // If already exists, that's okay - proceed to claim
                      if (createResult.error?.includes('already in use')) {
                        console.log('Claim ticket already exists, proceeding to claim...');
                      } else {
                        alert(`❌ Failed to create claim ticket: ${createResult.error}`);
                        return;
                      }
                    } else {
                      console.log('✅ Claim ticket created successfully');
                    }

                    // Step 2: Claim the prize
                    console.log('Step 2: Claiming prize...');
                    const claimResult = await claimPrize();
                    if (claimResult.success) {
                      const explorerUrl = `https://explorer.solana.com/tx/${claimResult.signature}?cluster=devnet`;
                      if (window.confirm(`🎉 Prize claimed successfully!\n\nView transaction on Solana Explorer?`)) {
                        window.open(explorerUrl, '_blank');
                      }
                      refresh(); // Refresh state
                    } else {
                      alert(`❌ Claim failed: ${claimResult.error}`);
                    }
                  }}
                  disabled={isProcessing}
                  style={{ marginBottom: '10px' }}
                >
                  {isProcessing ? 'CLAIMING...' : `CLAIM PRIZE (${(userStakeSOL + accruedInterest).toFixed(2)} SOL)`}
                </button>
                <button
                  className="result-action-button"
                  onClick={onBack}
                  style={{
                    background: 'linear-gradient(135deg, #444 0%, #222 100%)',
                    fontSize: '12px'
                  }}
                >
                  VIEW NEXT ROUND
                </button>
              </div>
            ) : userHasStakeInCompletedRound ? (
              // Loser View (has stake but didn't win)
              <div className="result-container loser">
                <div className="result-icon">😔</div>
                <div className="result-title">BETTER LUCK NEXT TIME</div>
                <div className="result-subtitle">YOUR TICKETS HAVE BEEN REFUNDED</div>

                <div className="prize-breakdown neutral">
                  <div className="breakdown-row main">
                    <span className="breakdown-label">REFUND AMOUNT</span>
                    <span className="breakdown-value">{userStakeSOL.toFixed(2)} SOL</span>
                  </div>
                  <div className="breakdown-divider"></div>
                  <div className="breakdown-row">
                    <span className="breakdown-label">Your Tickets</span>
                    <span className="breakdown-value">{userTicketCount} tickets ({userStakeSOL.toFixed(4)} SOL)</span>
                  </div>
                  <div className="breakdown-row">
                    <span className="breakdown-label">Round</span>
                    <span className="breakdown-value">#{epochId}</span>
                  </div>
                </div>

                <div className="winning-details">
                  <div className="detail-card">
                    <div className="detail-label">WINNING TICKET</div>
                    <div className="detail-value">#{winningTicket}</div>
                  </div>
                  <div className="detail-card">
                    <div className="detail-label">RANDOM NUMBER</div>
                    <div className="detail-value">{randomNumber}</div>
                  </div>
                </div>

                <button
                  className="result-action-button loser-button"
                  onClick={async () => {
                    const result = await processWithdrawal();
                    if (result.success) {
                      const explorerUrl = `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`;
                      if (window.confirm(`✅ Stake withdrawn successfully!\n\nView transaction on Solana Explorer?`)) {
                        window.open(explorerUrl, '_blank');
                      }
                      refresh(); // Refresh state
                    } else {
                      alert(`❌ Withdrawal failed: ${result.error}`);
                    }
                  }}
                  disabled={isProcessing}
                  style={{ marginBottom: '10px' }}
                >
                  {isProcessing ? 'WITHDRAWING...' : `WITHDRAW REFUND (${userStakeSOL.toFixed(2)} SOL)`}
                </button>
                <button
                  className="result-action-button"
                  onClick={onBack}
                  style={{
                    background: 'linear-gradient(135deg, #444 0%, #222 100%)',
                    fontSize: '12px'
                  }}
                >
                  TRY NEXT ROUND
                </button>
              </div>
            ) : (
              // Spectator View (no stake in this round)
              <div className="result-container" style={{ background: 'linear-gradient(135deg, #2c2c3e 0%, #1a1a2e 100%)' }}>
                <div className="result-icon">🎰</div>
                <div className="result-title">ROUND #{epochId} COMPLETE</div>
                <div className="result-subtitle">Winner has been selected!</div>

                <div className="winning-details" style={{ marginTop: '30px' }}>
                  <div className="detail-card">
                    <div className="detail-label">TOTAL TICKETS SOLD</div>
                    <div className="detail-value">{totalTicketsSold}</div>
                  </div>
                  <div className="detail-card">
                    <div className="detail-label">WINNER ADDRESS</div>
                    <div className="detail-value" style={{ fontSize: '10px' }}>
                      {roundState?.winner ? `${roundState.winner.slice(0, 4)}...${roundState.winner.slice(-4)}` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: '30px',
                  padding: '20px',
                  background: 'rgba(0, 255, 136, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid #00FF88',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#00FF88', marginBottom: '10px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>
                    ⚡ STARTING ROUND #{epochId + 1}...
                  </div>
                  <div style={{ color: '#AAA', fontSize: '11px' }}>
                    Please approve the transaction to continue
                  </div>
                </div>

                <button
                  className="result-action-button"
                  onClick={onBack}
                  style={{
                    background: 'linear-gradient(135deg, #444 0%, #222 100%)',
                    marginTop: '20px'
                  }}
                >
                  ← BACK TO MENU
                </button>
              </div>
            )}
          </div>
        ) : (
          // Main Content Grid - Active/Ended epochs
          <div className={`main-content-grid ${epochStatus === 'Ended' ? 'epoch-ended' : ''}`}>

          {/* Left Column: Pool Stats */}
          <div className="pool-stats-section">
            <div className="section-title">POOL STATISTICS</div>

            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <div className="stat-label">PARTICIPANTS</div>
                <div className="stat-value">{formatLargeNumber(totalParticipants)}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎟️</div>
              <div className="stat-info">
                <div className="stat-label">TOTAL TICKETS</div>
                <div className="stat-value">{formatLargeNumber(totalTicketsSold)}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎫</div>
              <div className="stat-info">
                <div className="stat-label">TOTAL TICKETS SOLD</div>
                <div className="stat-value">{formatLargeNumber(totalTicketsSold)} tickets</div>
                <div className="stat-sublabel" style={{ fontSize: '10px', marginTop: '3px' }}>
                  {formatLargeNumber(parseFloat(totalStaked.toFixed(2)))} SOL
                </div>
              </div>
            </div>

            <div className="stat-card highlight">
              <div className="stat-icon">💎</div>
              <div className="stat-info">
                <div className="stat-label">YOUR TICKETS</div>
                <div className="stat-value">
                  {userTicketCount > 0 ? `${userTicketCount} tickets` : '0 tickets'}
                </div>
                {userHasTickets && userTicketRange && (
                  <div className="stat-sublabel" style={{ color: '#00FF88', marginTop: '5px' }}>
                    🎫 {userTicketRange}
                  </div>
                )}
                {userStakeSOL > 0 && (
                  <div className="stat-sublabel" style={{ fontSize: '10px', marginTop: '3px' }}>
                    {userStakeSOL.toFixed(2)} SOL
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Buy Tickets */}
          <div className="buy-tickets-section">
            <div className="section-title">BUY TICKETS</div>

            <div className="ticket-purchase-card">
              <div className="ticket-input-group">
                <label className="input-label">NUMBER OF TICKETS</label>
                <div className="ticket-input-wrapper">
                  <button
                    className="ticket-btn ticket-btn-minus"
                    onClick={() => handleTicketsChange((ticketsToBuy - 1).toString())}
                    disabled={ticketsToBuy <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="ticket-input"
                    value={ticketsToBuy}
                    onChange={(e) => handleTicketsChange(e.target.value)}
                    min="1"
                    max="9999"
                    step="1"
                  />
                  <button
                    className="ticket-btn ticket-btn-plus"
                    onClick={() => handleTicketsChange((ticketsToBuy + 1).toString())}
                  >
                    +
                  </button>
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                  Each ticket costs 0.01 SOL
                </div>
              </div>

              <div className="calculation-display">
                <div className="calc-row">
                  <span className="calc-label">TICKETS ({ticketsToBuy}x)</span>
                  <span className="calc-value">{calculateTotal().toFixed(2)} SOL</span>
                </div>
                <div className="calc-row" style={{ background: '#1a1a2e', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
                  <span className="calc-label" style={{ color: '#FFD700' }}>YOU'LL GET TICKETS</span>
                  <span className="calc-value" style={{ color: '#FFD700', fontWeight: 'bold' }}>{getNextTicketNumbers()}</span>
                </div>
                <div className="calc-divider" style={{ marginTop: '8px' }}></div>
                <div className="calc-row total">
                  <span className="calc-label">TOTAL TO PAY</span>
                  <span className="calc-value">{calculateTotal().toFixed(4)} SOL</span>
                </div>
              </div>

              <button
                className="buy-button"
                disabled={!connected || ticketsToBuy === 0 || !canDeposit || isProcessing}
                onClick={handleBuyClick}
              >
                {!connected
                  ? 'CONNECT WALLET'
                  : isProcessing
                    ? 'PROCESSING...'
                    : !canDeposit
                      ? currentEpochInRound >= 3
                        ? 'DEPOSITS CLOSED (EPOCH 3)'
                        : 'ROUND CLOSED'
                      : `BUY ${ticketsToBuy} TICKET${ticketsToBuy !== 1 ? 'S' : ''}`}
              </button>

              {/* Ticket Preview */}
              {ticketsToBuy > 0 && epochStatus === 'Active' && connected && (
                <div className="ticket-preview-section">
                  <div className="section-subtitle preview-label">YOUR NEW TOTAL TICKETS</div>
                  <div className="ticket-summary" style={{ fontSize: '18px', color: '#00FF88', marginTop: '10px' }}>
                    {userTicketCount + ticketsToBuy} tickets ({(userStakeSOL + calculateTotal()).toFixed(2)} SOL)
                  </div>
                  <div style={{ color: '#888', fontSize: '10px', marginTop: '5px' }}>
                    Current: {userTicketCount} tickets + New: {ticketsToBuy} tickets
                  </div>
                </div>
              )}
            </div>

            {/* Current Tickets Display */}
            {userStakeSOL > 0 && connected && (
              <div className="ticket-visual-section">
                <div className="section-subtitle">YOUR CURRENT TICKETS</div>
                <div className="ticket-summary" style={{ fontSize: '24px', color: '#FFD700', marginTop: '15px' }}>
                  {userTicketCount} ticket{userTicketCount !== 1 ? 's' : ''}
                </div>
                {userHasTickets && userTicketRange && (
                  <div style={{ color: '#00FF88', fontSize: '14px', marginTop: '10px', fontFamily: '"Press Start 2P", monospace' }}>
                    🎫 {userTicketRange}
                    <div style={{ fontSize: '10px', marginTop: '5px', color: '#888' }}>
                      ({userStakeSOL.toFixed(4)} SOL)
                    </div>
                  </div>
                )}
                <div style={{ color: '#00FF88', fontSize: '12px', marginTop: '10px' }}>
                  ✓ ACTIVE IN LOTTERY
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Action Bar */}
        <div className="raffle-footer">
          <div className="action-instructions">
            <p>BUY TICKETS • LOSER TAKES START • {connected ? `WALLET: ${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}` : 'CONNECT WALLET'}</p>
          </div>

          <div className="action-buttons">
            <button className="raffle-button button-back" onClick={onBack}>
              ← BACK TO GAMES
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="modal-overlay" onClick={handleCancelPurchase}>
          <div className="modal-content confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">⚠️</div>
              <h2 className="modal-title">CONFIRM PURCHASE</h2>
            </div>

            <div className="modal-body">
              <div className="confirmation-details">
                <div className="confirm-row">
                  <span className="confirm-label">TICKETS TO BUY</span>
                  <span className="confirm-value">{ticketsToBuy} ticket{ticketsToBuy !== 1 ? 's' : ''}</span>
                </div>
                <div className="confirm-row" style={{ background: 'rgba(255, 215, 0, 0.1)', padding: '10px', borderRadius: '6px', border: '1px solid #FFD700' }}>
                  <span className="confirm-label" style={{ color: '#FFD700' }}>TICKET NUMBERS</span>
                  <span className="confirm-value" style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '16px' }}>{getNextTicketNumbers()}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">YOUR NEW TOTAL</span>
                  <span className="confirm-value">{userTicketCount + ticketsToBuy} tickets ({(userStakeSOL + calculateTotal()).toFixed(4)} SOL)</span>
                </div>
                <div className="confirm-divider"></div>
                <div className="confirm-row total">
                  <span className="confirm-label">TOTAL TO PAY</span>
                  <span className="confirm-value">{calculateTotal().toFixed(4)} SOL</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-button cancel-button" onClick={handleCancelPurchase}>
                CANCEL
              </button>
              <button className="modal-button confirm-button" onClick={handleConfirmPurchase}>
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="modal-overlay" onClick={handleCloseSuccess}>
          <div className="modal-content success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header success">
              <div className="modal-icon success">✓</div>
              <h2 className="modal-title">PURCHASE SUCCESSFUL!</h2>
            </div>

            <div className="modal-body">
              <div className="success-message">
                <p className="success-text">Your tickets have been purchased!</p>
                <div className="success-tickets">
                  <div className="success-label">TICKETS PURCHASED</div>
                  <div className="success-value">
                    {ticketsToBuy} ticket{ticketsToBuy !== 1 ? 's' : ''} ({calculateTotal().toFixed(4)} SOL)
                  </div>
                  {purchasedTicketNumbers && (
                    <div style={{
                      background: 'rgba(255, 215, 0, 0.15)',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '2px solid #FFD700',
                      marginTop: '15px'
                    }}>
                      <div style={{ color: '#FFD700', fontSize: '12px', marginBottom: '8px', fontFamily: '"Press Start 2P", monospace' }}>
                        🎫 YOUR NEW TICKETS
                      </div>
                      <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold', fontFamily: '"Press Start 2P", monospace' }}>
                        {purchasedTicketNumbers}
                      </div>
                    </div>
                  )}
                  {userHasTickets && userTicketRange && (
                    <div style={{ color: '#00FF88', fontSize: '14px', marginTop: '15px', fontFamily: '"Press Start 2P", monospace' }}>
                      📊 TOTAL TICKETS: {userTicketRange}
                      {userTicketCount > 1 && (
                        <div style={{ fontSize: '10px', marginTop: '5px' }}>
                          ({userTicketCount} tickets total)
                        </div>
                      )}
                    </div>
                  )}
                  <div className="success-range" style={{ marginTop: '15px' }}>
                    YOUR TOTAL: {userTicketCount} tickets ({userStakeSOL.toFixed(4)} SOL)
                  </div>
                  <div style={{ color: '#00FF88', fontSize: '12px', marginTop: '15px' }}>
                    ✓ TRANSACTION CONFIRMED ON BLOCKCHAIN
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-button close-button" onClick={handleCloseSuccess}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="modal-overlay wallet-modal-overlay">
          <div className="modal-content wallet-connection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <div className="wallet-modal-icon-container">
                <div className="wallet-modal-icon">🎪</div>
                <div className="wallet-modal-icon-glow"></div>
              </div>
              <h2 className="wallet-modal-title">WELCOME TO THE CIRCUS!</h2>
              <p className="wallet-modal-subtitle">Connect your wallet to join the raffle</p>
            </div>

            <div className="wallet-modal-body">
              <div className="wallet-features">
                <div className="wallet-feature">
                  <div className="feature-icon">🎟️</div>
                  <div className="feature-text">
                    <div className="feature-title">Buy Tickets</div>
                    <div className="feature-description">Purchase raffle tickets with SOL</div>
                  </div>
                </div>
                <div className="wallet-feature">
                  <div className="feature-icon">🎰</div>
                  <div className="feature-text">
                    <div className="feature-title">Win Big</div>
                    <div className="feature-description">Winner takes the entire fees from pool</div>
                  </div>
                </div>
                <div className="wallet-feature">
                  <div className="feature-icon">🔒</div>
                  <div className="feature-text">
                    <div className="feature-title">Secure & Fair</div>
                    <div className="feature-description">On-chain randomness ensures fairness</div>
                  </div>
                </div>
              </div>

              <div className="wallet-connect-section">
                <div className="wallet-connect-label">CHOOSE YOUR WALLET</div>
                <div className="wallet-button-wrapper">
                  <WalletMultiButton />
                </div>
                <div className="wallet-security-badge">
                  <span className="security-icon">🛡️</span>
                  <span className="security-text">Powered by Solana • Devnet</span>
                </div>
              </div>

              <div className="wallet-info-section">
                <div className="info-box">
                  <div className="info-icon">ℹ️</div>
                  <div className="info-content">
                    <div className="info-title">New to Solana?</div>
                    <div className="info-text">
                      You'll need a Solana wallet like Phantom, Solflare, or Backpack to participate.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="wallet-modal-footer">
              <button className="wallet-modal-back-button" onClick={onBack}>
                <span className="back-arrow">←</span> Back to Games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
