import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SalaryInsightsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Salary */}
        <div className="text-center p-4 bg-muted rounded-lg">
          <Skeleton className="h-9 w-24 mx-auto" />
          <Skeleton className="h-4 w-28 mx-auto mt-2" />
        </div>

        {/* Market Range */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto mt-2" />
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
