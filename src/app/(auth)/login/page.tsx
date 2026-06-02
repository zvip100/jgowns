import type { Metadata } from 'next';
import AuthPanel from '../AuthPanel';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Jgowns account to manage your listings.',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthPanel title="Welcome Back" subtitle="Sign in to manage your listings">
      <LoginForm />
    </AuthPanel>
  );
}
