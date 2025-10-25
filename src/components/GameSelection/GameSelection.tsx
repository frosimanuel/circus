import { useState, useEffect } from 'react';
import './GameSelection.css';

interface Game {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  available: boolean;
}

interface GameSelectionProps {
  onSelectGame: (gameId: string) => void;
  onBack: () => void;
}

const games: Game[] = [
  {
    id: 'staking-raffle',
    title: 'Staking Pool Raffle',
    icon: '01',
    color: '--icon-color-1: #FFD700; --icon-color-2: #FFA500; --icon-border: #CC8800;',
    description: 'Visual tier selection • Live countdown • Entry based on staking',
    available: true
  },
  {
    id: 'balloon-game',
    title: 'Balloon Game',
    icon: '02',
    color: '--icon-color-1: #FF0055; --icon-color-2: #FF3388; --icon-border: #CC0044;',
    description: 'Inflation mechanics • Pop animations • Risk/reward gameplay',
    available: false
  },
  {
    id: 'scratch-card',
    title: 'Scratch Card Experience',
    icon: '03',
    color: '--icon-color-1: #00FFFF; --icon-color-2: #0088FF; --icon-border: #0066CC;',
    description: 'Realistic scratch-reveal • Hidden prizes • Instant-win lottery',
    available: false
  },
  {
    id: 'community-raffles',
    title: 'Community Raffles Marketplace',
    icon: '04',
    color: '--icon-color-1: #AA00FF; --icon-color-2: #FF00AA; --icon-border: #880088;',
    description: 'Browse raffles • Escrow status • User-created raffle system',
    available: false
  },
  {
    id: 'prediction-markets',
    title: 'Prediction Markets',
    icon: '05',
    color: '--icon-color-1: #00FF88; --icon-color-2: #88FF00; --icon-border: #00AA44;',
    description: 'Yes/No predictions • Live results • Market outcome visuals',
    available: false
  },
  {
    id: 'monkey-battles',
    title: 'Monkey Battles Arena',
    icon: '06',
    color: '--icon-color-1: #FF8800; --icon-color-2: #FF4400; --icon-border: #CC4400;',
    description: 'Face-off duels • Elimination tournaments • Battle progression',
    available: false
  },
  {
    id: 'dashboard',
    title: 'Dashboard/Wallet View',
    icon: '07',
    color: '--icon-color-1: #0066FF; --icon-color-2: #00AAFF; --icon-border: #0055CC;',
    description: 'cSOL balance • CTK tracker • Active positions • Portfolio',
    available: false
  },
  {
    id: 'pro-mode',
    title: 'Pro Mode',
    icon: '08',
    color: '--icon-color-1: #FFFFFF; --icon-color-2: #AAAAAA; --icon-border: #888888;',
    description: 'Minimal aesthetic • Clean data-driven • Same functionality',
    available: false
  }
];

export const GameSelection: React.FC<GameSelectionProps> = ({ onSelectGame, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlinkOn(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : games.length - 1));
    } else if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev < games.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      const selectedGame = games[selectedIndex];
      if (selectedGame.available) {
        onSelectGame(selectedGame.id);
      }
    } else if (e.key === 'Escape') {
      onBack();
    }
  };

  return (
    <div className="game-selection-screen" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Background */}
      <div className="game-selection-bg"></div>

      {/* Circus Props */}
      <div className="circus-props-overlay">
        <div className="circus-prop prop-ball-floating" style={{ left: '10%', top: '20%', animationDelay: '0s' }}></div>
        <div className="circus-prop prop-ball-floating" style={{ left: '85%', top: '30%', animationDelay: '1.5s' }}></div>
        <div className="circus-sparkles sparkle-floating" style={{ left: '20%', top: '60%', animationDelay: '0s' }}></div>
        <div className="circus-sparkles sparkle-floating" style={{ left: '75%', top: '70%', animationDelay: '0.8s' }}></div>
        <div className="circus-sparkles sparkle-floating" style={{ left: '50%', top: '15%', animationDelay: '1.2s' }}></div>
      </div>

      {/* Main Content */}
      <div className="game-selection-content">
        {/* Header */}
        <div className="game-selection-header">
          <h1 className="game-selection-title">THE CIRCUS GAMES</h1>
          <p className="game-selection-subtitle">SELECT YOUR ADVENTURE</p>
        </div>

        {/* Games Grid */}
        <div className="games-grid">
          {games.map((game, index) => (
            <div
              key={game.id}
              className={`game-card ${selectedIndex === index ? 'selected' : ''} ${!game.available ? 'disabled' : ''}`}
              onClick={() => {
                setSelectedIndex(index);
                if (game.available) {
                  onSelectGame(game.id);
                }
              }}
            >
              <div className="game-card-inner">
                {selectedIndex === index && blinkOn && (
                  <span className="game-arrow">▶</span>
                )}
                <div className="game-icon" style={{ cssText: game.color } as React.CSSProperties}>
                  <span className="game-icon-number">
                    {game.icon}
                  </span>
                </div>
                <div className="game-info">
                  <h3 className="game-title">{game.title}</h3>
                  <p className="game-description">{game.description}</p>
                </div>
                {!game.available && (
                  <div className="coming-soon-label">
                    <span className="coming-soon-text">COMING SOON</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="game-selection-instructions">
          <p>↑↓ NAVIGATE • ENTER SELECT • ESC BACK</p>
        </div>

        {/* Back Button */}
        <div className="game-selection-footer">
          <button className="back-button" onClick={onBack}>
            ← BACK TO MENU
          </button>
        </div>
      </div>
    </div>
  );
};
