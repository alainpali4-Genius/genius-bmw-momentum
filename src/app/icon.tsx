import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#c6c6c6' }}>
        <svg width="64" height="64" viewBox="419 0 529 335" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          <rect x="419" y="0" width="529" height="335" fill="#c6c6c6"/>
          <path d="M474 0 H614 L419 335 H279 Z" fill="#ed2118"/>
          <path d="M614 0 H742 V139 L822 0 H948 V335 H830 V194 L750 335 H638 V194 L558 335 H419 Z" fill="#ffffff"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
