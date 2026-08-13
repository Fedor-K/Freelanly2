/**
 * Scoped to /dashboard deliberately. This file used to sit at src/app/loading.tsx, where it applied
 * to EVERY route — and a loading shell makes the route stream immediately, which locks the HTTP
 * status at 200 before the page can throw notFound(). Every missing public URL therefore rendered
 * the 404 page with a 200, i.e. a soft 404, which search engines index as a real page
 * (/blog/[slug] and /freelance/[slug] both did this). The dashboard is behind auth and not indexed,
 * so it keeps the spinner; the public routes give up the spinner and get honest status codes.
 * Do not move this back up to the app root.
 */
export default function Loading() {
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh'}}>
      <div style={{textAlign: 'center'}}>
        <div style={{width: '32px', height: '32px', border: '3px solid #E6E3D8', borderTopColor: '#0A0B0F', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto'}} />
        <p style={{marginTop: '12px', color: '#5C6068', fontSize: '13px'}}>Loading...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
