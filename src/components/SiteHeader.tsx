import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StoreCartDrawer } from "@/components/StoreCartDrawer";
import { useCustomerStore, truncateEmail } from "@/stores/customerStore";
import { cn } from "@/lib/utils";
import logo from "@/assets/bessa-logo.png";

type NavLink =
  | { type: "route"; to: string; label: string }
  | { type: "hash"; hash: string; label: string };

const NAV_LINKS: NavLink[] = [
  { type: "route", to: "/destaques", label: "Destaques" },
  { type: "route", to: "/colecao", label: "Coleção" },
  { type: "route", to: "/parcerias", label: "Parcerias" },
  { type: "hash", hash: "marca", label: "A Marca" },
  { type: "hash", hash: "contato", label: "Contato" },
];

function resolveHref(link: NavLink, isHome: boolean): string {
  if (link.type === "route") return link.to;
  return isHome ? `#${link.hash}` : `/#${link.hash}`;
}

function isActive(link: NavLink, pathname: string): boolean {
  if (link.type === "route") return pathname === link.to;
  return false;
}

type SiteHeaderProps = {
  homeOnlyNav?: boolean;
};

export function SiteHeader({ homeOnlyNav = true }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const customerEmail = useCustomerStore((s) => s.email);
  const isLoggedIn = useCustomerStore((s) => s.isLoggedIn());
  const logout = useCustomerStore((s) => s.logout);

  const navItems: Array<{ href: string; label: string; active: boolean; isRoute: boolean; to?: string }> =
    NAV_LINKS.map((link) => ({
      href: resolveHref(link, isHome),
      label: link.label,
      active: isActive(link, pathname),
      isRoute: link.type === "route",
      to: link.type === "route" ? link.to : undefined,
    }));

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const renderNavItem = (item: (typeof navItems)[0], className: string) => {
    const activeClass = item.active ? "text-gold" : "hover:text-gold";
    if (item.isRoute && item.to) {
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={closeMenu}
          className={cn(className, activeClass, "transition-colors")}
        >
          {item.label}
        </Link>
      );
    }
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={closeMenu}
        className={cn(className, activeClass, "transition-colors")}
      >
        {item.label}
      </a>
    );
  };

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-gold/30 bg-background/95 backdrop-blur-xl shadow-gold-lg h-14"
          : "border-gold/15 bg-background/70 backdrop-blur-lg h-16",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90">
          <img
            src={logo}
            alt="Bessa's Box"
            className={cn("w-auto transition-all duration-300", scrolled ? "h-8" : "h-10")}
          />
        </Link>

        <nav
          className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide"
          aria-label="Navegação principal"
        >
          {!homeOnlyNav && (
            <Link
              to="/"
              className={cn(
                "py-1 transition-colors",
                pathname === "/" ? "text-gold" : "hover:text-gold",
              )}
            >
              Início
            </Link>
          )}
          {navItems.map((item) => renderNavItem(item, "relative py-1"))}
          {isLoggedIn && customerEmail ? (
            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-gold/20">
              <span className="text-xs text-muted-foreground max-w-[120px] truncate" title={customerEmail}>
                {truncateEmail(customerEmail, 18)}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs text-gold hover:text-gold-soft tracking-wide"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              to="/conta/entrar"
              className={cn(
                "py-1 transition-colors ml-2",
                pathname.startsWith("/conta") ? "text-gold" : "hover:text-gold",
              )}
            >
              Entrar
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden border-gold/40 bg-background/50"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5 text-gold" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(100%,300px)] bg-background border-r border-gold/30"
            >
              <SheetHeader>
                <SheetTitle className="font-display text-xl text-left tracking-wide">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-8" aria-label="Navegação mobile">
                {!homeOnlyNav && (
                  <Link
                    to="/"
                    onClick={closeMenu}
                    className="text-lg font-medium tracking-wide py-3 px-2 rounded-md hover:text-gold hover:bg-gold/5 transition-colors"
                  >
                    Início
                  </Link>
                )}
                {navItems.map((item) => renderNavItem(item, "text-lg font-medium tracking-wide py-3 px-2 rounded-md hover:bg-gold/5"))}
                {isLoggedIn && customerEmail ? (
                  <div className="mt-4 pt-4 border-t border-gold/15 px-2 space-y-2">
                    <p className="text-sm text-muted-foreground truncate">{customerEmail}</p>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                      className="text-sm text-gold hover:text-gold-soft"
                    >
                      Sair da conta
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/conta/entrar"
                    onClick={closeMenu}
                    className="text-lg font-medium tracking-wide py-3 px-2 rounded-md hover:text-gold hover:bg-gold/5 transition-colors block mt-2 border-t border-gold/15"
                  >
                    Entrar
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
          <StoreCartDrawer />
        </div>
      </div>
    </header>
  );
}
