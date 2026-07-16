import { TopBar } from "@/components/app-shell/top-bar";
import { UserNav } from "@/components/app-shell/user-nav";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <TopBar />
      <UserNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
