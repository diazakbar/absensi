import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";

// 👇 1. Import komponen pembersih server yang baru kita bikin
import { ServerManager } from "@/components/server-manager"; 

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, isAdmin, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-5" />
            <div className="flex flex-1 items-center justify-between gap-3">
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-xs text-muted-foreground">Selamat datang,</span>
                <span className="text-sm font-medium text-foreground">
                  {fullName ?? user?.email}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                
                {/* 👇 2. Bagian Admin yang udah disisipin ikon Server */}
                {isAdmin && (
                  <>
                    <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline">
                      Admin
                    </span>
                    <ServerManager />
                  </>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}