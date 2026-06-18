
'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'compact';
}

export function BrandLogo({ className, variant = 'full' }: BrandLogoProps) {
  const brandLogo = PlaceHolderImages.find(img => img.id === 'brand-logo');
  
  if (!brandLogo) return null;

  // Usamos unoptimized={true} para que Next.js no intente procesar la imagen local en build
  // y src="/logo-momentum.png" para que la busque en la raíz de la carpeta public.
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <Image 
        src="/logo-momentum.png" 
        alt="Momentum Product Genius"
        width={variant === 'full' ? 240 : 120}
        height={variant === 'full' ? 120 : 60}
        className="object-contain"
        priority
        unoptimized={true}
      />
    </div>
  );
}
