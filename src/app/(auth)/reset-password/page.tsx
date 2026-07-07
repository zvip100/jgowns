import AuthScreen from '../AuthScreen';
import ResetPasswordForm from './ResetPasswordForm';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Choose a new password for your account.',
  robots: { index: false },
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthScreen
      title="Reset Password"
      subtitle="Choose a new password for your account"
      searchParams={searchParams}
      hasGoogleAuth={false}
      renderForm={(next) => <ResetPasswordForm next={next} />}
    />
  );
}
