'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { MapPin, Star, ChevronLeft, Share2, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAdvancedHaptics } from '@/lib/haptics';

interface VenueHeaderProps {
  venue: any;
  tableNumber?: string;
}

export function VenueHeader({ venue, tableNumber }: VenueHeaderProps) {
  const router = useRouter();
  const haptics = useAdvancedHaptics();
  const [isLiked, setIsLiked] = useState(false);
  
  const { scrollY } = useScroll();
  
  const imageY = useTransform(scrollY, [0, 200], [0, 50]);
  const imageScale = useTransform(scrollY, [0, 200], [1, 1.1]);
  const headerOpacity = useTransform(scrollY, [100, 200], [0, 1]);
  const contentOpacity = useTransform(scrollY, [0, 100], [1, 0]);

  const handleBack = () => {
    haptics.trigger('light');
    router.back();
  };

  const handleShare = async () => {
    haptics.trigger('light');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: venue.name,
          text: `Check out ${venue.name} on EasyMO!`,
          url: window.location.href,
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleLike = () => {
    haptics.trigger('medium');
    setIsLiked(!isLiked);
  };

  const isOpen = true; // Simplified for now

  return (
    <>
      <motion.header
        style={{ opacity: headerOpacity }}
        className={cn(
          'fixed top-0 inset-x-0 z-40',
          'bg-background/80 backdrop-blur-xl border-b border-border',
          'h-14 flex items-center px-4'
        )}
      >
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center font-semibold truncate mx-4">
          {venue.name}
        </h1>
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </motion.header>

      <div className="relative h-72 overflow-hidden">
        <motion.div
          style={{ y: imageY, scale: imageScale }}
          className="absolute inset-0"
        >
          {venue.cover_image_url ? (
            <Image
              src={venue.cover_image_url}
              alt={venue.name}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </motion.div>

        <motion.div
          style={{ opacity: contentOpacity }}
          className="absolute top-0 inset-x-0 p-4 flex justify-between items-start"
        >
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={handleLike}
              className={cn(
                'w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center',
                isLiked ? 'bg-red-500' : 'bg-black/30'
              )}
            >
              <Heart
                className={cn('w-5 h-5', isLiked ? 'text-white fill-white' : 'text-white')}
              />
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: contentOpacity }}
          className="absolute bottom-0 inset-x-0 p-4"
        >
          {venue.logo_url && (
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-background shadow-lg mb-3">
              <Image
                src={venue.logo_url}
                alt={venue.name}
                width={64}
                height={64}
                className="object-cover"
              />
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{venue.name}</h1>
              {venue.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {venue.description}
                </p>
              )}
            </div>
            
            {venue.rating && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="font-semibold text-primary">{venue.rating}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isOpen ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className={isOpen ? 'text-green-500' : 'text-red-500'}>
                {isOpen ? 'Open Now' : 'Closed'}
              </span>
            </div>

            {venue.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{venue.address}</span>
              </div>
            )}
          </div>

          {tableNumber && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium"
            >
              <span>📍</span>
              <span>Table {tableNumber}</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
}
