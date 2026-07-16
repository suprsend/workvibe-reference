import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
