import { createFileRoute } from "@tanstack/react-router";
import { CatalogPageLayout } from "@/components/CatalogPageLayout";
import { fetchProductsForStore } from "@/lib/catalog";
import type { ShopifyProduct } from "@/lib/shopify";

const FEATURED_COUNT = 4;

export const Route = createFileRoute("/destaques")({
  loader: async () => {
    try {
      const products = await fetchProductsForStore(FEATURED_COUNT, {
        featuredOnly: true,
      });
      return { products };
    } catch (error) {
      console.error("Destaques loader failed:", error);
      return { products: [] as ShopifyProduct[] };
    }
  },
  component: DestaquesPage,
  head: () => ({
    meta: [
      { title: "Destaques — Bessa's Box" },
      {
        name: "description",
        content: "Seleção da casa: peças premium em destaque na Bessa's Box.",
      },
    ],
  }),
});

function DestaquesPage() {
  const { products } = Route.useLoaderData();

  return (
    <CatalogPageLayout
      eyebrow="Em destaque"
      title="Seleção da casa"
      description="Os modelos que definem o momento Bessa's Box — curadoria com quantidades limitadas e acabamento premium."
      products={products}
      variant="featured"
      secondaryLink={{ label: "Ver coleção completa", to: "/colecao" }}
    />
  );
}
