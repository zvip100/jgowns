import AuthScreen from '../AuthScreen';
import RegisterForm from './RegisterForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create a free Jgowns account to list and sell your modest gowns.',
};

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthScreen
      title="Create Account"
      subtitle="Start selling your wedding gown today"
      searchParams={searchParams}
      renderForm={(next) => <RegisterForm next={next} />}
    />
  );
}
