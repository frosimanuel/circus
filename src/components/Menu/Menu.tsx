import { useState, useEffect } from 'react';
import './Menu.css';

interface MenuProps {
  onStart?: () => void;
  onInfo?: () => void;
}

/**
 * Circus Finance - SEGA-Style Minimalist Menu
 *
 * Clean, simple, fits on screen. Like the classics.
 */
export const Menu: React.FC<MenuProps> = ({ onStart, onInfo }) => {
  const [blinkOn, setBlinkOn] = useState(true);
  const [selectedOption, setSelectedOption] = useState<'start' | 'info'>('start');

  useEffect(() => {
    const interval = setInterval(() => {
      setBlinkOn(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      setSelectedOption(prev => prev === 'start' ? 'info' : 'start');
    }
    if (e.key === 'Enter' || e.key === ' ') {
      handleSelect();
    }
  };

  const handleSelect = (option?: 'start' | 'info') => {
    const optionToUse = option || selectedOption;
    if (optionToUse === 'start') {
      onStart?.();
    } else {
      onInfo?.();
    }
  };

  return (
    <div className="sega-menu" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Black Background */}
      <div className="sky-gradient"></div>

      {/* Pixel Art Animations */}
      <div className="pixel-animations">
        {/* Circus Scene */}
        <div className="circus-charlie-scene-full">
          {/* Fire Hoops - Left and Right Sides Only */}
          <div className="fire-hoop hoop-left">
          </div>

          <div className="fire-hoop hoop-right">
          </div>

          {/* Original Clown Convoy - Three Clown Friends in Line */}
          <div className="clown-bike clown-leader">
            <div className="clown-sprite"></div>
          </div>

          <div className="clown-bike clown-follower-1">
            <div className="clown-sprite-blue"></div>
          </div>

          <div className="clown-bike clown-follower-2">
            <div className="clown-sprite-green"></div>
          </div>

          {/* Circus Props and Accessories */}
          <div className="circus-prop prop-ball-1"></div>
          <div className="circus-prop prop-ball-2"></div>
          <div className="circus-prop prop-ring-1"></div>
          <div className="circus-prop prop-ring-2"></div>
          <div className="circus-sparkles sparkle-1"></div>
          <div className="circus-sparkles sparkle-2"></div>
          <div className="circus-sparkles sparkle-3"></div>


          {/* Platform/Ground */}
          <div className="circus-platform-full"></div>
        </div>

        {/* Pixel Art Balloons */}
        <div className="pixel-balloon balloon-red" style={{ left: '20%', animationDelay: '0s' }}>
          <div className="balloon-sprite red-balloon"></div>
        </div>

        <div className="pixel-balloon balloon-blue" style={{ left: '70%', animationDelay: '3s' }}>
          <div className="balloon-sprite blue-balloon"></div>
        </div>

        <div className="pixel-balloon balloon-yellow" style={{ left: '45%', animationDelay: '6s' }}>
          <div className="balloon-sprite yellow-balloon"></div>
        </div>

      </div>


      {/* Main Content */}
      <div className="menu-main">

        {/* Title */}
        <div className="game-title">
          <h1 className="title-text">CIRCUS FINANCE</h1>
          <p className="subtitle-text">MONEY UNDER THE BIG TOP</p>
        </div>

        {/* Menu Options */}
        <div className="menu-list">
          <div
            className={`menu-option ${selectedOption === 'start' ? 'active' : ''}`}
            onClick={() => { setSelectedOption('start'); handleSelect('start'); }}
          >
            {selectedOption === 'start' && <span className="arrow">▶</span>}
            <span>START</span>
          </div>

          <div
            className={`menu-option ${selectedOption === 'info' ? 'active' : ''}`}
            onClick={() => { setSelectedOption('info'); handleSelect('info'); }}
          >
            {selectedOption === 'info' && <span className="arrow">▶</span>}
            <span>HOW TO PLAY</span>
          </div>
        </div>

        {/* Press Start */}
        <div className="press-start-container">
          {blinkOn && <p className="press-start-text">PRESS START</p>}
        </div>

        {/* Copyright */}
        <p className="copyright-text">© 2025 CIRCUS FINANCE</p>
      </div>
    </div>
  );
};
