'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export function BmwLogo({ className }: LogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={cn("w-full h-full transition-colors duration-200", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Círculo base blanco/plata */}
      <circle cx="50" cy="50" r="48" fill="white" />
      
      {/* Anillo Negro Exterior */}
      <circle cx="50" cy="50" r="44" fill="#000000" />

      {/* Cuadrantes centrales BMW */}
      <g transform="translate(50, 50)">
        <path d="M0 0 L0 -32 A32 32 0 0 1 32 0 Z" fill="#0066BC" />
        <path d="M0 0 L0 32 A32 32 0 0 1 -32 0 Z" fill="#0066BC" />
        <path d="M0 0 L-32 0 A32 32 0 0 1 0 -32 Z" fill="white" />
        <path d="M0 0 L32 0 A32 32 0 0 1 0 32 Z" fill="white" />
        <circle r="32" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
      </g>
      
      {/* Letras BMW que reaccionan al hover a través de currentColor */}
      <g fill="currentColor" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="11" textAnchor="middle">
        <text transform="translate(31, 38) rotate(-45)">B</text>
        <text transform="translate(50, 26)">M</text>
        <text transform="translate(69, 38) rotate(45)">W</text>
      </g>
    </svg>
  );
}

export function MLogo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 40" 
      className={cn("h-full w-auto transition-colors duration-200", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="skewX(-20) translate(10, 0)">
        <rect x="0" y="8" width="8" height="24" fill="#00AEEF" />
        <rect x="9" y="8" width="8" height="24" fill="#14284B" />
        <rect x="18" y="8" width="8" height="24" fill="#ED1C24" />
      </g>
      
      {/* Letra M que reacciona al hover a través de currentColor */}
      <path 
        d="M45 32 L45 8 L56 8 L63 22 L70 8 L81 8 L81 32 L73 32 L73 14 L63 32 L53 14 L53 32 Z" 
        fill="currentColor" 
      />
    </svg>
  );
}
