import { ImageResponse } from 'next/og';

// Configuración del icono BMW oficial
export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
          borderRadius: '50%',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Anillo exterior negro */}
          <circle cx="50" cy="50" r="48" fill="black" />
          
          {/* Cuadrantes centrales BMW */}
          {/* Top Left - Blue */}
          <path d="M50,50 L50,18 A32,32 0 0,0 18,50 Z" fill="#0066B3" />
          {/* Top Right - White */}
          <path d="M50,50 L82,50 A32,32 0 0,0 50,18 Z" fill="white" />
          {/* Bottom Right - Blue */}
          <path d="M50,50 L50,82 A32,32 0 0,1 82,50 Z" fill="#0066B3" />
          {/* Bottom Left - White */}
          <path d="M50,50 L18,50 A32,32 0 0,1 50,82 Z" fill="white" />

          {/* Letras BMW simplificadas para 32px */}
          <g fill="white" style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            <text x="30" y="36" transform="rotate(-45, 30, 36)">B</text>
            <text x="44" y="28">M</text>
            <text x="64" y="32" transform="rotate(45, 64, 32)">W</text>
          </g>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
