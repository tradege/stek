'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ backgroundColor: '#0a0a1a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>{error.message || 'An unexpected error occurred'}</p>
          <button
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(to right, #06b6d4, #3b82f6)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
