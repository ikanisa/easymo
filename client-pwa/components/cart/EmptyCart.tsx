'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface EmptyCartProps {
  venueSlug: string;
}

export function EmptyCart({ venueSlug }: EmptyCartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
        <ShoppingBag className="w-12 h-12 text-muted-foreground" />
      </div>
      
      <h2 className="text-2xl font-display font-semibold mb-2">
        Your cart is empty
      </h2>
      
      <p className="text-muted-foreground mb-6 max-w-sm">
        Add some delicious items from the menu to get started
      </p>

      <Link href={`/${venueSlug}`}>
        <Button size="lg">Browse Menu</Button>
      </Link>
    </motion.div>
  );
}
