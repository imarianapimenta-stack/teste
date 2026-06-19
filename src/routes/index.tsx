import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalculadoraApp } from "@/components/CalculadoraApp";

const TAB_VALUES = [
  "home",
  "calculadora",
  "ponto",
  "clientes",
  "sugestoes",
  "logs",
  "perfis",
  "config",
  "relatorios",
  "clientelogs",
] as const;

const indexSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  head: () => ({
    meta: [
      { title: "Mecânica Braba — Site" },
      { name: "description", content: "Calculadora oficial de serviços da Mecânica Braba." },
      { property: "og:title", content: "Mecânica Braba — Calculadora" },
      { property: "og:description", content: "Calculadora oficial de serviços da Mecânica Braba." },
    ],
  }),
  component: Index,
});

function Index() {
  return <CalculadoraApp />;
}
