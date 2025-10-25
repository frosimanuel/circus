import { useEffect, useState } from 'react';
import './HowToPlay.css';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onBack }) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onBack]);

  return (
    <div className="how-to-play">
      <div className="how-to-play-container">
        <div className="how-to-play-header">
          <h1 className="retro-title">NO-LOSE RAFFLE</h1>
        </div>

        <div className="content-scroll">
          <div className="text-block">
            <p className="text-line">BUY TICKETS AT 0.01 SOL EACH</p>
            <p className="text-line">YOUR SOL STAKES IN LIQUIDITY POOL</p>
            <p className="text-line">POOL GENERATES YIELD WHILE ROUND RUNS</p>
          </div>

          <div className="divider"></div>

          <div className="text-block">
            <p className="text-line highlight-green">WINNER: GETS ALL YIELD + PRINCIPAL</p>
            <p className="text-line highlight-red">LOSERS: GET PRINCIPAL BACK</p>
          </div>

          <div className="divider"></div>

          <div className="text-block">
            <p className="text-line small">EXAMPLE:</p>
            <p className="text-line small">100 TICKETS SOLD = 1 SOL STAKED</p>
            <p className="text-line small">POOL EARNS 0.1 SOL YIELD</p>
            <p className="text-line small">WINNER CLAIMS: 0.01 + 0.1 = 0.11 SOL</p>
            <p className="text-line small">OTHERS CLAIM: 0.01 SOL BACK EACH</p>
          </div>

          <div className="divider"></div>

          <div className="text-block">
            <p className="text-line small">ROUND: 3 EPOCHS / ~6 MINUTES</p>
            <p className="text-line small">DRAW: RANDOM TICKET NUMBER</p>
            <p className="text-line small">SETTLEMENT: ON-CHAIN INSTANT</p>
          </div>
        </div>

        <div className="how-to-play-controls">
          <button className="retro-button back-button" onClick={onBack}>
            BACK
          </button>
        </div>
      </div>
    </div>
  );
};
