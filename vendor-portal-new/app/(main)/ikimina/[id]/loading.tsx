import { Skeleton } from "@/components/ui/skeleton";

export default function IkiminaDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 rounded-3xl" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
