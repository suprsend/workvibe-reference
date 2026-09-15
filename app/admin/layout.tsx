import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { WorkspaceRequired, WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { loadWorkspaceViews } from "@/lib/server/workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { workspaces, error } = await loadWorkspaceViews();
  return (
    <WorkspaceShell workspaces={workspaces} error={error}>
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <WorkspaceRequired>{children}</WorkspaceRequired>
        </main>
      </div>
    </WorkspaceShell>
  );
}
