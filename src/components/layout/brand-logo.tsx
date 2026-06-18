
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

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <Image 
        src={brandLogo.imageUrl} 
        alt={brandLogo.description}
        width={variant === 'full' ? 240 : 120}
        height={variant === 'full' ? 120 : 60}
        className="object-contain"
        priority
        data-ai-hint={brandLogo.imageHint}
      />
    </div>
  );
}
