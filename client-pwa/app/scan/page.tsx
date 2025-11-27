import type { Metadata } from 'next';
import { QRScanner } from './QRScanner';

export const metadata: Metadata = {
  title: 'Scan QR Code - EasyMO',
  description: 'Scan a table QR code to view the menu',
};

export default function ScanPage() {
  return <QRScanner />;
}
