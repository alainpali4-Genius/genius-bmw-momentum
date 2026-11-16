
'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'sidebar' | 'mobile';
}

export function BrandLogo({ className, variant = 'full' }: BrandLogoProps) {
  // Dimensiones ajustadas a las especificaciones: 
  // Sidebar: 180-220px
  // Móvil: Altura máx 36px
  const dimensions = {
    full: { width: 220, height: 80 },
    sidebar: { width: 190, height: 70 },
    mobile: { width: 64, height: 28 }
  };

  const { width, height } = dimensions[variant];

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <Image 
        src="/logo-product-genius.png" 
        alt="Product Genius Logo"
        width={width}
        height={height}
        className="object-contain"
        priority
        unoptimized={true}
      />
    </div>
  );
}
