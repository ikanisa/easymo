<<<<<<< HEAD
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Vendor Portal
          </h1>
          <p className="text-gray-600 mb-8">
            SACCO and MFI Management Platform
          </p>
          
          <div className="space-y-4">
            <Link
              href="/login"
              className="block w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Login to Dashboard
            </Link>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-4">Features:</p>
              <ul className="text-sm text-gray-600 space-y-2 text-left">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Member Management</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Payment Processing & SMS Integration</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Group Savings (Ikimina) Management</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Financial Reports & Analytics</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
=======
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
>>>>>>> feature/location-caching-and-mobility-deep-review
}
