// lib/auth.ts
import { AuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import prisma from '@/lib/prisma';

export const authOptions: AuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      //console.log('SignIn callback - user:', user);
      if (!user.email) {
        console.log('No email provided');
        return false;
      }

      try {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        //console.log('Existing user exists.');

        if (!existingUser) {
          // Create new user
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || '',
              image: user.image || '',
            },
          });
          console.log('Created new user:', newUser);
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session }) {
      //console.log('Session callback - token:', token);
      if (session.user?.email) {
        try {
          // Always fetch fresh user data from database
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
          });

          //console.log('Session callback - dbUser:', dbUser);

          if (dbUser) {
            // Return fresh user data
            return {
              ...session,
              user: {
                ...session.user,
                id: dbUser.id,
                name: dbUser.name,
                username: dbUser.username,
                image: dbUser.image,
                pageTitle: dbUser.pageTitle,
                pageDesc: dbUser.pageDesc,
                theme: dbUser.theme,
              },
            };
          }
        } catch (error) {
          console.error('Error in session callback:', error);
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      //console.log('JWT callback - token:', token, 'user:', user);
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/error',
  },
  debug: true,
};

// Helper function to get server session
import { getServerSession } from 'next-auth/next';

export async function getAuthSession() {
  const session = await getServerSession(authOptions);
  return session;
}
