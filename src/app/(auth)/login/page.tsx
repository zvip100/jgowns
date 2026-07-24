import AuthScreen from '../AuthScreen';
import LoginForm from './LoginForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Jgowns account to manage your listings.',
  robots: { index: false },
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default function LoginPage({
  searchParams,
}: LoginPageProps) {
  return (
    <AuthScreen
      title="Welcome Back"
      subtitle="Sign in to manage your listings and saved gowns"
      searchParams={searchParams}
      renderForm={(next) => <LoginForm next={next} />}
    />
  );
}
