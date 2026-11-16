import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <svg width="64" height="64" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0 55)">
            <path d="M5 232 L72 18 L120 18 L53 232 Z" fill="#25A6D1"/>
            <path d="M53 232 L120 18 L169 18 L102 232 Z" fill="#292B83"/>
            <path d="M102 232 L169 18 L216 18 L149 232 Z" fill="#D32630"/>
            <path d="M149 232 L216 18 L265 18 L247 111 L290 18 L355 18 L334 232 L282 232 L300 119 L251 232 Z" fill="#F1F2F3"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
