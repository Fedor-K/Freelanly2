import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container py-8">
        {/* Dashboard header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-6 w-28 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
