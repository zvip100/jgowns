import AuthScreen from '../AuthScreen';
import LoginForm from './LoginForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Jgowns account to manage your listings.',
  robots: { index: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthScreen
      title="Welcome Back"
      subtitle="Sign in to manage your listings"
      searchParams={searchParams}
      renderForm={(next) => <LoginForm next={next} />}
    />
  );
}
