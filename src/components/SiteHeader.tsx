import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/CartDrawer";
import logo from "@/assets/bessa-logo.png";

const NAV_LINKS = [
  { href: "/#colecao", label: "Coleção" },
  { href: "/#marca", label: "A Marca" },
  { href: "/#contato", label: "Contato" },
] as const;

type SiteHeaderProps = {
  /** When false (e.g. PDP), show "Início" plus section anchors */
  homeOnlyNav?: boolean;
};

export function SiteHeader({ homeOnlyNav = true }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = homeOnlyNav
    ? NAV_LINKS
    : [{ href: "/", label: "Início" as const }, ...NAV_LINKS];

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-gold/20 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="Bessa's Box" className="h-10 w-auto" />
        </Link>

        <nav
          className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide"
          aria-label="Navegação principal"
        >
          {links.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-gold transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden border-gold/40"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5 text-gold" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,280px)] bg-background border-r border-gold/30">
              <SheetHeader>
                <SheetTitle className="font-display text-xl text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8" aria-label="Navegação mobile">
                {links.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className="text-lg font-medium tracking-wide hover:text-gold transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <CartDrawer />
        </div>
      </div>
    </header>
  );
}
