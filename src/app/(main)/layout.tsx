import { Suspense } from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import WishlistServerSync from "@/components/wishlist/WishlistServerSync";

type MainLayoutProps = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <WishlistProvider>
      <div className='flex min-h-svh flex-col'>
        <Navbar />
        <main
          id='main-content'
          className='mx-auto w-full max-w-375 flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-10'
        >
          {children}
        </main>
        <Footer />
      </div>
      <Suspense fallback={null}>
        <WishlistServerSync />
      </Suspense>
    </WishlistProvider>
  );
}
