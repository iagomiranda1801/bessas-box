import barberLogo from "@/assets/photo-barber.jpeg";

export type Partner = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logo: string;
  logoAlt: string;
  /** URL externa (Instagram, site). Opcional. */
  href?: string;
  benefits: string[];
};

export const PARTNERS: Partner[] = [
  {
    id: "barbearia-bs",
    name: "Barbearia B's",
    tagline: "Parceria oficial",
    description:
      "Cuidado pessoal e estilo masculino no mesmo padrão da Bessa's Box: presença, acabamento e atenção aos detalhes.",
    logo: barberLogo,
    logoAlt: "Logo da Barbearia B's — parceiro Bessa's Box",
    benefits: [
      "Experiência completa: moda premium + grooming",
      "Atendimento com foco em estilo e presença",
      "Parceria pensada para quem valoriza qualidade",
    ],
  },
];
