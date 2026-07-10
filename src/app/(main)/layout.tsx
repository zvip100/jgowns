import Navbar from "@/components/Navbar";

type MainLayoutProps = {
  children: React.ReactNode;
};

export default function MainLayout({
  children,
}: MainLayoutProps) {
  return (
    <>
      <Navbar />
      <main
        id='main-content'
        className='mx-auto w-full max-w-375 px-4 py-8 sm:px-6 sm:py-10 lg:px-10'
      >
        {children}
      </main>
      <footer className='mx-auto mt-16 w-full max-w-375 px-4 pb-10 text-center text-sm text-[#7f6c5b] sm:px-6 lg:px-10'>
        © 2026 Jgowns. All rights reserved.
      </footer>
    </>
  );
}
