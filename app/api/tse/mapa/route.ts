/**
 * GET /api/tse/mapa?cargo=1
 *
 * Resumo das 27 UFs para o coroplético. A lógica (e o porquê de `agregavel`)
 * está em lib/tse/servico.ts → obterMapa.
 */
import { NextResponse } from "next/server";
import { obterMapa } from "@/lib/tse/servico";

export const revalidate = 30;

export async function GET(requisicao: Request) {
  const cargo = new URL(requisicao.url).searchParams.get("cargo") ?? "1";
  const r = await obterMapa(cargo);

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
  return NextResponse.json(r.dados, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
