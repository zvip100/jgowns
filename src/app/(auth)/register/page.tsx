import type { Metadata } from 'next';
import AuthPanel from '../AuthPanel';
import RegisterForm from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create a free Jgowns account to list and sell your modest gowns.',
};

export default function RegisterPage() {
  return (
    <AuthPanel title="Create Account" subtitle="Start selling your wedding gown today">
      <RegisterForm />
    </AuthPanel>
  );
}
