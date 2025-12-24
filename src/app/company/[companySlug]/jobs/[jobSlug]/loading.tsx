import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';

export default function JobDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container py-8">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-64 bg-muted rounded animate-pulse mb-6" />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job header skeleton */}
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-xl bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-7 w-80 bg-muted rounded animate-pulse" />
                <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              </div>
            </div>

            {/* Tags skeleton */}
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
              <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
            </div>

            {/* Description skeleton */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-6 w-40 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-4 w-full bg-muted rounded animate-pulse" />
                  ))}
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Salary insights skeleton */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                <div className="h-24 w-full bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>

            {/* Apply card skeleton */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-10 w-full bg-primary/20 rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
