import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listStubPartners } from "@/lib/stubs/multicountry";

export default async function PartnersPage() {
  const useStub = process.env.AUTH_E2E_STUB === "1";

  let orgs: Array<{
    id: string;
    name: string;
    type: string;
    country_id: string;
    countries?: { name: string; iso2: string } | null;
  }> | null = null;
  let error: unknown = null;

  if (useStub) {
    orgs = listStubPartners().map(({ org }) => org);
  } else {
    const supa = createSupabaseAdminClient();
    const response = await supa
      .from("organizations")
      .select("id, name, type, country_id, countries(name, iso2)")
      .neq("type", "DISTRICT");
    orgs = (response.data as typeof orgs) ?? null;
    error = response.error;
  }

  const errorMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "Unknown error")
      : error
        ? String(error)
        : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Partners (SACCO/MFI/BANK)</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure partner organizations and their settings
        </p>
      </div>

      {errorMessage ? (
        <div className="text-red-500">Failed to load partners: {errorMessage}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {orgs?.map((o: any) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3">{o.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {o.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.countries?.name} ({o.countries?.iso2})
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/partners/${o.id}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                    >
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!orgs ||
            (orgs.length === 0 && (
              <div className="p-8 text-center text-gray-500">No partner organizations found.</div>
            ))}
        </div>
      )}
    </div>
  );
}
