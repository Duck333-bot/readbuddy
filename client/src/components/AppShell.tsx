import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookMarked, LogOut, NotebookPen } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

function initialsOf(name: string | null | undefined) {
  if (!name) return "R";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display ${className}`}>
      <span className="relative flex h-5 w-4 items-center justify-center" aria-hidden="true">
        <span className="rb-thread absolute h-4 rotate-[28deg]" />
        <span className="rb-thread-node relative" />
      </span>
      <span className="inline-flex items-baseline gap-[1px]">
      <span className="font-semibold">Read</span>
      <span className="font-normal italic text-primary">Buddy</span>
      </span>
    </span>
  );
}

type AppShellProps = {
  children: ReactNode;
  /** Reader uses its own minimal chrome, so the nav can be hidden. */
  bare?: boolean;
};

export function AppShell({ children, bare = false }: AppShellProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/library", label: "Library", icon: BookMarked },
    { href: "/notebook", label: "Notebook", icon: NotebookPen },
  ];

  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-6 px-5 sm:px-8">
          <Link
            href="/library"
            className="text-[1.08rem] text-foreground no-underline transition-opacity hover:opacity-75">
            <Wordmark />
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const active = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 text-sm no-underline transition-colors duration-150 ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <span className="flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                    {item.label}
                  </span>
                  {active && (
                    <span className="absolute inset-x-3 -bottom-[17px] h-[1.5px] bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 gap-2 rounded-full px-2 hover:bg-accent"
                    aria-label="Account menu">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/12 text-[11px] font-medium text-primary">
                        {initialsOf(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[9rem] truncate text-sm text-muted-foreground sm:inline">
                      {user.name ?? "Reader"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium">{user.name ?? "Reader"}</p>
                    {user.email && (
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void logout()}>
                    <LogOut className="mr-2 h-3.5 w-3.5" strokeWidth={1.9} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default AppShell;
