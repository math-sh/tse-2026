/**
 * GET /api/tse/resultado?cargo=1[&uf=sp][&mu=71072]
 *
 * Existe porque o TSE não manda `Access-Control-Allow-Origin`: o navegador não
 * consegue falar com ele direto. De quebra, o cache daqui é o que protege o rate
 * limit do TSE, que é por IP — e com proxy o IP é um só para todo mundo.
 */
import { NextResponse } from "next/server";
import { obterResultado } from "@/lib/tse/servico";

export const revalidate = 30;

export async function GET(requisicao: Request) {
  const p = new URL(requisicao.url).searchParams;
  const r = await obterResultado({
    cargo: p.get("cargo") ?? "1",
    uf: p.get("uf")?.toLowerCase() || null,
    mu: p.get("mu") || null,
  });

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
  return NextResponse.json(r.dados, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
