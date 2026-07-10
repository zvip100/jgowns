import AuthScreen from '../AuthScreen';
import ForgotPasswordForm from './ForgotPasswordForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request an email link to reset your account password.',
  robots: { index: false },
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  return (
    <AuthScreen
      title="Forgot Password"
      subtitle="We'll email you a link to reset it"
      searchParams={searchParams}
      hasGoogleAuth={false}
      renderForm={(next) => <ForgotPasswordForm next={next} />}
    />
  );
}
