import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Send,
  Sparkles,
  Library,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { DemoBanner } from "@/components/demo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveBrand, useSetActiveBrand } from "@/lib/use-brand";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Home", icon: Home, help: "Your overview and what needs you" },
  {
    to: "/create",
    label: "Create content",
    icon: PenLine,
    help: "Write new posts, emails and articles",
  },
  {
    to: "/brand-kit",
    label: "Brand Kit",
    icon: BookOpen,
    help: "Your voice, rules, facts and audiences",
  },
  {
    to: "/library",
    label: "Library",
    icon: Library,
    help: "Review, approve and export content",
  },
  {
    to: "/publish",
    label: "Publish",
    icon: Send,
    help: "Send approved pieces to LinkedIn and more",
  },
  { to: "/team", label: "Team", icon: Users, help: "People, roles and who can approve" },
  {
    to: "/onboarding",
    label: "Set up a brand",
    icon: Sparkles,
    help: "A five-minute guided setup",
  },
] as const;

/** Create and Review start as the icon rail so the work area gets the room. */
function isFocusScreen(path: string) {
  return path === "/create" || path.startsWith("/create/") || path.startsWith("/library/");
}
const storageKey = (focus: boolean) => `bvs.sidebar.${focus ? "focus" : "default"}`;

/** Collapsed state per kind of screen, remembered in this browser. */
function useSidebarCollapsed(path: string) {
  const focus = isFocusScreen(path);
  const [stored, setStored] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const next: Record<string, boolean> = {};
      for (const f of [true, false]) {
        const v = window.localStorage.getItem(storageKey(f));
        if (v === "collapsed" || v === "expanded") next[storageKey(f)] = v === "collapsed";
      }
      setStored(next);
    } catch {
      // Storage unavailable: fall back to the screen default.
    }
  }, []);
  const key = storageKey(focus);
  const collapsed = stored[key] ?? focus;
  const toggle = () => {
    const next = !collapsed;
    setStored((s) => ({ ...s, [key]: next }));
    try {
      window.localStorage.setItem(key, next ? "collapsed" : "expanded");
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  };
  return { collapsed, toggle };
}

function RailTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function BrandSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { brand, brands } = useActiveBrand();
  const setActive = useSetActiveBrand();
  if (!brand) return null;
  const name = `${brand.name}${brand.is_demo ? " (sample)" : ""}`;
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const items = (
    <SelectContent>
      {brands.map((b) => (
        <SelectItem key={b.id} value={b.id}>
          {b.name}
          {b.is_demo ? " (sample)" : ""}
        </SelectItem>
      ))}
    </SelectContent>
  );
  if (collapsed)
    return (
      <Select value={brand.id} onValueChange={(v) => setActive.mutate(v)}>
        <RailTip label={`Writing for ${name}`}>
          <SelectTrigger
            aria-label={`Writing for ${name}. Switch brand`}
            className="mx-auto size-10 justify-center bg-card px-0 text-xs font-semibold [&>svg]:hidden"
          >
            {initials}
          </SelectTrigger>
        </RailTip>
        {items}
      </Select>
    );
  return (
    <div className="space-y-1.5">
      <label htmlFor="brand-switcher" className="px-1 text-xs font-medium text-muted-foreground">
        Writing for
      </label>
      <Select value={brand.id} onValueChange={(v) => setActive.mutate(v)}>
        <SelectTrigger id="brand-switcher" className="h-10 bg-card">
          <SelectValue />
        </SelectTrigger>
        {items}
      </Select>
    </div>
  );
}

function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Main" className="flex flex-col gap-2">
      {NAV.map((item) => {
        const active = path.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed ? "mx-auto w-10 justify-center" : "px-3",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-56">
              {collapsed ? (
                <>
                  <span className="block font-medium">{item.label}</span>
                  <span className="block opacity-90">{item.help}</span>
                </>
              ) : (
                item.help
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { profile } = useActiveBrand();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const toggle = onToggle && (
    <RailTip label={collapsed ? "Expand menu" : "Collapse menu"}>
      <Button
        variant="ghost"
        size={collapsed ? "icon" : "sm"}
        onClick={onToggle}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        aria-expanded={!collapsed}
        className={cn(
          "h-9 text-muted-foreground",
          collapsed ? "mx-auto w-9" : "justify-start px-3",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        ) : (
          <>
            <PanelLeftClose className="size-4" aria-hidden="true" /> Collapse menu
          </>
        )}
      </Button>
    </RailTip>
  );

  return (
    <div className={cn("flex h-full flex-col gap-6 py-5", collapsed ? "px-2" : "px-4")}>
      <Link
        to="/dashboard"
        onClick={onNavigate}
        aria-label="Brand Voice Studio, go to Home"
        className={cn("min-w-0 whitespace-nowrap", collapsed && "mx-auto")}
      >
        <Logo compact={collapsed} />
      </Link>
      <BrandSwitcher collapsed={collapsed} />
      <NavLinks onNavigate={onNavigate} collapsed={collapsed} />
      <div className="mt-auto flex flex-col gap-2 border-t pt-4">
        {toggle}
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <span className="truncate text-sm text-muted-foreground">{profile?.display_name}</span>
          )}
          {collapsed ? (
            <RailTip label="Sign out">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={signOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </Button>
            </RailTip>
          ) : (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggle } = useSidebarCollapsed(path);

  // Join any team someone invited this email address to.
  useEffect(() => {
    void supabase.rpc("accept_my_invites").then(({ data }) => {
      if (data && data > 0) {
        toast.success(`You've joined ${data === 1 ? "a new team" : `${data} new teams`}.`);
        void qc.invalidateQueries();
      }
    });
  }, [qc]);
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "min-h-screen lg:grid",
          collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]",
        )}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <aside
          aria-label="Menu"
          className="sticky top-0 hidden h-screen overflow-y-auto border-r bg-sidebar lg:block"
        >
          <SidebarBody collapsed={collapsed} onToggle={toggle} />
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <main id="main" className="min-w-0">
          <DemoBanner />
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
