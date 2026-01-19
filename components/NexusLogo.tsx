
import React from 'react';

export const NexusLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 200 200" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <defs>
      <linearGradient id="brainGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#c084fc" /> {/* Purple-400 */}
        <stop offset="100%" stopColor="#818cf8" /> {/* Indigo-400 */}
      </linearGradient>
      <linearGradient id="circuitGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38bdf8" /> {/* Sky-400 */}
        <stop offset="100%" stopColor="#2563eb" /> {/* Blue-600 */}
      </linearGradient>
    </defs>

    {/* Left Side: Organic Brain (Human) */}
    <g transform="translate(10, 10) scale(0.9)">
        <path 
            d="M90 30 C 70 30, 50 40, 40 60 C 20 70, 10 100, 20 130 C 30 160, 60 170, 90 170" 
            stroke="url(#brainGradient)" 
            strokeWidth="8" 
            strokeLinecap="round"
            fill="none"
        />
        {/* Brain Folds */}
        <path d="M45 70 C 55 60, 75 60, 85 75" stroke="url(#brainGradient)" strokeWidth="6" strokeLinecap="round" />
        <path d="M35 100 C 50 95, 70 105, 85 100" stroke="url(#brainGradient)" strokeWidth="6" strokeLinecap="round" />
        <path d="M35 130 C 50 140, 70 130, 85 145" stroke="url(#brainGradient)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="60" cy="85" r="4" fill="url(#brainGradient)" />
        <circle cx="55" cy="115" r="4" fill="url(#brainGradient)" />
        <circle cx="70" cy="125" r="3" fill="url(#brainGradient)" />
    </g>

    {/* Right Side: Digital Brain (AI) */}
    <g transform="translate(10, 10) scale(0.9)">
        <path 
            d="M110 30 C 130 30, 150 40, 160 60 C 180 70, 190 100, 180 130 C 170 160, 140 170, 110 170" 
            stroke="url(#circuitGradient)" 
            strokeWidth="8" 
            strokeLinecap="round"
            fill="none"
        />
        {/* Circuit Lines */}
        <path d="M110 50 H 130 L 145 65" stroke="url(#circuitGradient)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="145" cy="65" r="4" fill="url(#circuitGradient)" />

        <path d="M110 90 H 140 L 160 110" stroke="url(#circuitGradient)" strokeWidth="5" strokeLinecap="round" />
        <rect x="156" y="106" width="8" height="8" fill="url(#circuitGradient)" />

        <path d="M110 140 H 130 L 150 120" stroke="url(#circuitGradient)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="150" cy="120" r="4" fill="#fff" stroke="url(#circuitGradient)" strokeWidth="2" />
        
        {/* Chip connection outside */}
        <path d="M175 90 H 190" stroke="url(#circuitGradient)" strokeWidth="4" />
        <path d="M175 100 H 190" stroke="url(#circuitGradient)" strokeWidth="4" />
        <path d="M175 110 H 190" stroke="url(#circuitGradient)" strokeWidth="4" />
    </g>

    {/* Center Gap/Connection */}
    <path d="M100 40 V 160" stroke="white" strokeWidth="2" strokeDasharray="4 4" opacity="0.2" />
  </svg>
);
