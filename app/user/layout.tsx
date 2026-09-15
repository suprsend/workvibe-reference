import { TopBar } from "@/components/app-shell/top-bar";
import { UserNav } from "@/components/app-shell/user-nav";
import { WorkspaceRequired, WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { loadWorkspaceViews } from "@/lib/server/workspace";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const { workspaces, error } = await loadWorkspaceViews();
  return (
    <WorkspaceShell workspaces={workspaces} error={error}>
      <TopBar />
      <UserNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 lg:p-8">
        <WorkspaceRequired>{children}</WorkspaceRequired>
      </main>
    </WorkspaceShell>
  );
}
