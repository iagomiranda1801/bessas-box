import { Link, useRouterState } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { SectionAnchor } from "@/components/SectionAnchor";
import logo from "@/assets/bessa-logo.png";

export function SiteFooter() {
  const isHome = useRouterState({ select: (s) => s.location.pathname === "/" });

  return (
    <footer className="relative py-16 border-t border-gold/20 bg-card/20">
      <SectionAnchor id="contato" />
      <div className="absolute inset-0 bg-gold-radial opacity-50 pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="space-y-4">
          <img src={logo} alt="Bessa's Box" className="h-12 w-auto" />
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Tênis, camisetas e polos. Moda premium com entrega para todo o Brasil.
          </p>
        </div>
        <div className="space-y-3">
          <p className="font-display text-lg tracking-wide">Navegação</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/destaques" className="hover:text-gold transition-colors">
                Destaques
              </Link>
            </li>
            <li>
              <Link to="/colecao" className="hover:text-gold transition-colors">
                Coleção
              </Link>
            </li>
            <li>
              {isHome ? (
                <a href="#marca" className="hover:text-gold transition-colors">
                  A marca
                </a>
              ) : (
                <Link to="/" hash="marca" className="hover:text-gold transition-colors">
                  A marca
                </Link>
              )}
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="font-display text-lg tracking-wide">Fale com a gente</p>
          <a
            href="https://www.instagram.com/bessasbox"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm hover:text-gold transition-colors"
            aria-label="Instagram da Bessa's Box (abre em nova aba)"
          >
            <Instagram className="w-4 h-4" aria-hidden="true" /> @bessasbox
          </a>
        </div>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 mt-10 pt-6 border-t border-gold/20 text-xs text-muted-foreground flex flex-col sm:flex-row sm:justify-between gap-2">
        <p>© {new Date().getFullYear()} Bessa's Box. Todos os direitos reservados.</p>
        <p className="text-gold/70 tracking-widest uppercase">Premium casual</p>
      </div>
    </footer>
  );
}
