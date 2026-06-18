
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
          fontSize: 24,
          background: '#003399',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '20%',
          color: 'white',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Círculo exterior del volante */}
          <circle cx="12" cy="12" r="10" />
          {/* Radios del volante */}
          <line x1="12" y1="12" x2="12" y2="3" />
          <line x1="12" y1="12" x2="5" y2="18" />
          <line x1="12" y1="12" x2="19" y2="18" />
          {/* Centro del volante */}
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
