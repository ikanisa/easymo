export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure environment toggles, access management, and integrations.
        </p>
      </div>
      <div className="space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Environment</h2>
          <p className="mt-1 text-sm text-gray-500">
            The admin panel reads configuration from environment variables. Update Netlify build settings and Supabase secrets to change these values.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium">Supabase URL:</span> {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "Not set"}
            </li>
            <li>
              <span className="font-medium">Anon key present:</span> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Yes" : "No"}
            </li>
            <li>
              <span className="font-medium">Environment label:</span> {process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging"}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
