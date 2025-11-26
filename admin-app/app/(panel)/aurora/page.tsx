/**
 * Aurora Home - Entry point for the modernized admin panel
 */
import { redirect } from 'next/navigation';

export default function AuroraPage() {
  // Redirect to dashboard by default
  redirect('/aurora/dashboard');
}
