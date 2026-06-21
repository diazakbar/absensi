import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  History,
  Users,
  School,
  GraduationCap,
  CalendarCheck,
  CalendarClock, // <-- Ikon baru buat Jadwal
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const pengajarItems = [
  { title: "Absen Hari Ini", url: "/", icon: ClipboardList, exact: true },
  { title: "Riwayat", url: "/riwayat", icon: History },
];

const adminItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Master Jadwal", url: "/admin/jadwal", icon: CalendarClock }, // <-- Menu baru ditambahin di sini
  { title: "Pengajar & Gaji", url: "/admin", icon: Users, exact: true },
  { title: "Semua Absensi", url: "/admin/absensi", icon: CalendarCheck },
  { title: "Sekolah & Harga", url: "/admin/sekolah", icon: School },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, fullName, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const items = isAdmin ? adminItems : pengajarItems;
  const groupLabel = isAdmin ? "Admin" : "Menu";

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link
          to={isAdmin ? "/admin/dashboard" : "/"}
          className="flex items-center gap-2.5 px-2 py-2 text-sidebar-foreground"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold tracking-tight">
                Absen Pengajar
              </span>
              <span className="text-[11px] text-muted-foreground">
                Kursus Privat
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            {/* 1. Avatar Bulat */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {(fullName ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            
            {/* 2. Nama & Role (Pake flex-1 biar dia ngedorong tombol setting ke pojok kanan) */}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {fullName ?? user?.email}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Admin" : "Pengajar"}
              </div>
            </div>

            {/* 3. TOMBOL GEAR SETTINGS MUNCUL DI SINI */}
            <Link
              to="/profile"
              onClick={handleNavClick} // Biar nutup sidebar di HP pas di-klik
              className="p-1.5 shrink-0 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
              title="Pengaturan Akun"
            >
              <Settings className="h-4 w-4" />
            </Link>

          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
