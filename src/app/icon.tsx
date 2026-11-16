import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <svg width="64" height="64" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 234 L76 121 L118 121 L58 234 Z" fill="#25A6D1"/>
          <path d="M58 234 L118 121 L164 121 L104 234 Z" fill="#292B83"/>
          <path d="M104 234 L164 121 L207 121 L147 234 Z" fill="#D32630"/>
          <path d="M147 234 L207 121 L252 121 L236 174 L273 121 L319 121 L300 234 L256 234 L269 174 L232 234 Z" fill="#E7E7E7"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
