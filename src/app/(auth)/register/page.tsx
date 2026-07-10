import AuthScreen from '../AuthScreen';
import RegisterForm from './RegisterForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create a free Jgowns account to list and sell your modest gowns.',
};

type RegisterPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  return (
    <AuthScreen
      title="Create Account"
      subtitle="Start selling your wedding gown today"
      searchParams={searchParams}
      renderForm={(next) => <RegisterForm next={next} />}
    />
  );
}
