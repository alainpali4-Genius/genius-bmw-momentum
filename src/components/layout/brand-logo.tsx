
'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'sidebar' | 'mobile';
}

export function BrandLogo({ className, variant = 'full' }: BrandLogoProps) {
  // Dimensiones basadas en la variante solicitada
  const dimensions = {
    full: { width: 220, height: 80 },
    sidebar: { width: 200, height: 72 },
    mobile: { width: 100, height: 36 }
  };

  const { width, height } = dimensions[variant];

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <Image 
        src="/logo-product-genius.png" 
        alt="BMW MINI M Product Genius"
        width={width}
        height={height}
        className="object-contain"
        priority
        unoptimized={true}
      />
    </div>
  );
}
