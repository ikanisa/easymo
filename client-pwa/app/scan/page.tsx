'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, QrCode } from 'lucide-react';
import { useAdvancedHaptics } from '@/lib/haptics';

export default function ScanPage() {
  const router = useRouter();
  const haptics = useAdvancedHaptics();

  const handleClose = () => {
    haptics.trigger('light');
    router.back();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-center p-8">
        <QrCode className="w-24 h-24 mx-auto text-white mb-4" />
        <h1 className="text-white text-2xl font-bold mb-2">QR Scanner</h1>
        <p className="text-white/70 mb-8">Scanner implementation in progress</p>
        
        <button
          onClick={handleClose}
          className="px-6 py-3 bg-white text-black rounded-full font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
