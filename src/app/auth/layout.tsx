import type { ReactNode } from "react";

import { PublicHeader } from "@/components/public/PublicHeader";
import { StudyArtwork } from "@/components/public/StudyArtwork";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-paper">
      <PublicHeader />

      <div className="mx-auto grid min-h-[calc(100dvh-72px)] w-full max-w-[1440px] border-x border-line lg:grid-cols-[minmax(440px,0.82fr)_minmax(0,1.18fr)]">
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[470px]">{children}</div>
        </section>

        <StudyArtwork />
      </div>
    </main>
  );
}
