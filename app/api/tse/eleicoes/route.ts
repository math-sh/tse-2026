/**
 * GET /api/tse/eleicoes
 *
 * Espelha o `ele-c.json` do TSE, que é o catálogo de pleitos e cargos. O
 * dashboard usa o registro estático de `lib/tse/cargos.ts` no caminho normal;
 * esta rota serve para conferir no dia se os códigos do turno configurado ainda
 * batem, sem adivinhar.
 */
import { NextResponse } from "next/server";
import {
  CICLO,
  ELEICOES_1O_TURNO,
  ELEICOES_2O_TURNO,
  ELE_ESTADUAL,
  ELE_FEDERAL,
  TURNO,
} from "@/lib/tse/cargos";
import { urlEleicoes } from "@/lib/tse/endpoints";
import { REVALIDATE, buscarTse } from "@/lib/tse/fetch";

interface RawEleicoes {
  dg: string;
  hg: string;
  pl: Array<{
    cd: string;
    c: string;
    dt: string;
    e: Array<{
      cd: string;
      cdt2?: string;
      t: string;
      nm: string;
      abr?: Array<{ cd: string; cp?: Array<{ cd: string; ds: string; tp: string }> }>;
    }>;
  }>;
}

export const revalidate = 3600;

export async function GET() {
  try {
    const bruto = await buscarTse<RawEleicoes>(urlEleicoes(), REVALIDATE.config);

    const doCiclo = (bruto.pl ?? [])
      .filter((p) => p.c === CICLO)
      .flatMap((p) =>
        (p.e ?? []).map((e) => ({
          pleito: p.cd,
          data: p.dt,
          eleicao: e.cd,
          segundoTurno: e.cdt2 || null,
          turno: e.t,
          nome: e.nm,
          // O 2º turno estadual declara os cargos por UF (`abr[].cp`), não em
          // `br`; por isso a lista é deduplicada entre todas as abrangências.
          cargos: [
            ...new Map(
              (e.abr ?? [])
                .flatMap((a) => a.cp ?? [])
                .map((c) => [
                  c.cd,
                  { codigo: c.cd, nome: c.ds, proporcional: c.tp === "2" },
                ] as const),
            ).values(),
          ],
          ufsComCargo: (e.abr ?? []).filter((a) => (a.cp?.length ?? 0) > 0).map((a) => a.cd),
        })),
      );

    return NextResponse.json(
      {
        geradoEm: `${bruto.dg} ${bruto.hg}`,
        ciclo: CICLO,
        turnoConfigurado: TURNO,
        emUso: { federal: ELE_FEDERAL, estadual: ELE_ESTADUAL },
        primeiroTurno: ELEICOES_1O_TURNO,
        segundoTurno: ELEICOES_2O_TURNO,
        eleicoes: doCiclo,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao consultar o TSE." },
      { status: 502 },
    );
  }
}
