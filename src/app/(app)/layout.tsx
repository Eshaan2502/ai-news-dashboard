import { Masthead } from "@/components/Masthead";
import { BackButton } from "@/components/BackButton";

/** Chrome for the signed-in app: masthead + content column. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <BackButton />
        {children}
      </main>
    </>
  );
}
