import AuthScreen from '../AuthScreen';
import ForgotPasswordForm from './ForgotPasswordForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request an email link to reset your account password.',
  robots: { index: false },
};

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
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
