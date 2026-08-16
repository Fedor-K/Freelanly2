import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';

function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
            <div className="flex gap-2 mt-3">
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CategoryLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container py-8">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-muted rounded animate-pulse mb-6" />

        {/* Page header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-72 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>

        {/* Filters skeleton */}
        <div className="flex gap-2 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 w-24 bg-muted rounded animate-pulse" />
          ))}
        </div>

        {/* Job list skeleton */}
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex justify-center gap-2 mt-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
