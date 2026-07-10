import Link from 'next/link';
import Logo from '@/components/Logo';

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='flex min-h-svh flex-col items-center bg-[#f5f0e7]'>
      <header className='w-full px-6 py-6 flex justify-center'>
        <Link href='/' aria-label='Back to Jgowns'>
          <Logo className='h-10 w-auto' />
        </Link>
      </header>
      <main className='w-full flex-1 px-4 pb-16'>
        {children}
      </main>
    </div>
  );
}
