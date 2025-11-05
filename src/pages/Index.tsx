import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Index() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to the main admin app
    window.location.href = "/admin-app";
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting to Admin Panel...</h1>
        <p className="text-gray-600">
          Please use the <a href="/admin-app" className="text-blue-600 underline">Admin App</a> for dashboard access.
        </p>
      </div>
    </div>
  );
}
