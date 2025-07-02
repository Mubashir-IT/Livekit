import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./sidebar-context";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { isOpen } = useSidebar();

  return (
    <div className="relative min-h-screen bg-slate-50">
      <AppSidebar />
      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          "md:pt-0", // Add padding top for mobile menu
          isOpen ? "md:pl-64 " : "pl-0"
        )}
      >
        <div className="w-full h-full">{children}</div>
      </main>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
