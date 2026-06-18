
import { ImageResponse } from 'next/og';

// Configuración del icono
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
          background: 'transparent',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Anillo exterior gris/plateado */}
          <circle cx="50" cy="50" r="48" fill="white" stroke="#A6A9AA" strokeWidth="2" />
          
          {/* Anillo interior de separación */}
          <circle cx="50" cy="50" r="44" fill="white" stroke="#A6A9AA" strokeWidth="1" />
          
          {/* Cuadrantes centrales */}
          {/* Top Left - Blue */}
          <path d="M50,50 L50,15 A35,35 0 0,0 15,50 Z" fill="#0066B3" />
          {/* Top Right - White */}
          <path d="M50,50 L85,50 A35,35 0 0,0 50,15 Z" fill="white" />
          {/* Bottom Right - Blue */}
          <path d="M50,50 L50,85 A35,35 0 0,1 85,50 Z" fill="#0066B3" />
          {/* Bottom Left - White */}
          <path d="M50,50 L15,50 A35,35 0 0,1 50,85 Z" fill="white" />

          {/* Letras BMW (Simplificadas para legibilidad en 32x32) */}
          <g fill="#A6A9AA" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            <text x="28" y="38" transform="rotate(-40, 28, 38)">B</text>
            <text x="44" y="28">M</text>
            <text x="62" y="34" transform="rotate(40, 62, 34)">W</text>
          </g>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
