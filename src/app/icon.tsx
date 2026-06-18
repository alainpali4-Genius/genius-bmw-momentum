import { ImageResponse } from 'next/og';

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
          {/* Anillo exterior negro */}
          <circle cx="50" cy="50" r="48" fill="#1A1A1A" />
          
          {/* Centro BMW Blanco */}
          <circle cx="50" cy="50" r="32" fill="white" />
          
          {/* Cuadrantes azules oficiales */}
          <path d="M50,50 L50,18 A32,32 0 0,0 18,50 Z" fill="#0066B3" />
          <path d="M50,50 L50,82 A32,32 0 0,1 82,50 Z" fill="#0066B3" />

          {/* Texto BMW en el anillo */}
          <g fill="white" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
            <text x="32" y="38" transform="rotate(-45, 32, 38)">B</text>
            <text x="44" y="27">M</text>
            <text x="64" y="34" transform="rotate(45, 64, 34)">W</text>
          </g>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
