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
