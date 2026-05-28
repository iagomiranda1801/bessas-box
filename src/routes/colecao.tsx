import { createFileRoute } from "@tanstack/react-router";
import { CatalogPageLayout } from "@/components/CatalogPageLayout";
import { fetchProductsForStore } from "@/lib/catalog";
import type { ShopifyProduct } from "@/lib/shopify";

export const Route = createFileRoute("/colecao")({
  loader: async () => {
    try {
      const products = await fetchProductsForStore(48);
      return { products };
    } catch (error) {
      console.error("Coleção loader failed:", error);
      return { products: [] as ShopifyProduct[] };
    }
  },
  component: ColecaoPage,
  head: () => ({
    meta: [
      { title: "Coleção — Bessa's Box" },
      {
        name: "description",
        content: "Catálogo completo: tênis, camisetas e polos premium Bessa's Box.",
      },
    ],
  }),
});

function ColecaoPage() {
  const { products } = Route.useLoaderData();

  return (
    <CatalogPageLayout
      eyebrow="Catálogo"
      title="Todos os produtos"
      description="Explore a coleção completa. Cada peça com caimento impecável, estoque limitado e entrega para todo o Brasil."
      products={products}
      variant="grid"
      secondaryLink={{ label: "Ver destaques", to: "/destaques" }}
    />
  );
}
