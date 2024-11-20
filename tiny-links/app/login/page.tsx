// app/login/page.tsx
'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      if (session.user?.username) {
        router.push('/dashboard');
      } else {
        router.push('/register');
      }
    }
  }, [session, router]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFCC00]">
      <div className="w-full max-w-md rounded-lg border-2 border-black bg-white p-8 shadow-lg">
        {/* Logo */}
        <div className="mx-auto mb-6 h-16 w-16">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <path
              d="M35.5 70.5c-3-15-2-27.5 4.5-34.5 6-6.5 14-8.5 19-8.5 8.5 0 15 3.5 18.5 7.5 4 4.5 5.5 10 5.5 14 0 6.5-3 11.5-6.5 15-4 4-9 6.5-13 7.5-2.5.5-5.5 1-9 1-7 0-13.5-1-19-2z"
              fill="black"
            />
          </svg>
        </div>

        <h2 className="mb-6 text-center text-2xl font-bold">Welcome to tiny.pm</h2>

        {status === 'loading' ? (
          <div className="text-center">Loading...</div>
        ) : session ? (
          <div className="space-y-4">
            <p className="text-center">Signed in as {session.user?.email}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push('/register')}
                className="w-full rounded-lg bg-black px-4 py-2 text-[#FFCC00] transition-colors hover:bg-gray-900"
              >
                Continue Setup
              </button>
              <button
                onClick={handleSignOut}
                className="w-full rounded-lg border border-black px-4 py-2 text-black transition-colors hover:bg-gray-100"
              >
                Not you? Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-[#FFCC00] transition-colors hover:bg-gray-900"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}