import { getMemberHomeData } from "@/lib/member/data";
import { MySaccos } from "@/components/member/saccos/my-saccos";
import { SaccoSearch } from "@/components/member/saccos/sacco-search";

export default async function MemberSaccosPage() {
  const { saccos } = await getMemberHomeData();

  return (
    <div className="space-y-8 text-neutral-0">
      <section className="space-y-3">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">My SACCOs</h1>
          <p className="text-sm text-white/70">
            Link SACCOs to unlock their ibimina groups and balances.
          </p>
        </header>
        <MySaccos saccos={saccos} />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Add a SACCO</h2>
        <SaccoSearch />
      </section>
    </div>
  );
}
