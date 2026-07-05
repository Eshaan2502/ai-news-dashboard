import { Masthead } from "@/components/Masthead";

/** Chrome for the signed-in app: masthead + content column. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
