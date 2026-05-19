import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col flex-1">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
