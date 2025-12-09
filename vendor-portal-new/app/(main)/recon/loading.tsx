import { Skeleton } from "@/components/ui/skeleton";

export default function ReconLoading() {
  return (
    <div className="space-y-8">
      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-5 w-56" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
