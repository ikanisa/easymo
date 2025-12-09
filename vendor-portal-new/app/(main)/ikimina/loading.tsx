import { Skeleton } from "@/components/ui/skeleton";

export default function IkiminaListLoading() {
  return (
    <div className="space-y-8">
      <div className="glass rounded-3xl p-6">
        <Skeleton className="mb-3 h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="glass rounded-3xl p-6">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12" />
          ))}
        </div>
      </div>
    </div>
  );
}
