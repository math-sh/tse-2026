/**
 * GET /api/tse/municipios?uf=sp
 *
 * A lista completa do TSE tem ~520 KB para o país inteiro, então filtramos por UF
 * no servidor e devolvemos só o necessário para o combobox. Cacheada por 1h —
 * a lista de municípios não muda no meio de uma eleição.
 */
import { NextResponse } from "next/server";
import { CARGO_PADRAO, cargoPorCodigo } from "@/lib/tse/cargos";
import { urlMunicipios } from "@/lib/tse/endpoints";
import { REVALIDATE, buscarTse } from "@/lib/tse/fetch";
import { normalizarMunicipios } from "@/lib/tse/normalize";
import { ehUfValida } from "@/lib/tse/ufs";
import type { RawMunicipiosConfig } from "@/lib/tse/raw-types";

export const revalidate = 3600;

export async function GET(requisicao: Request) {
  const params = new URL(requisicao.url).searchParams;
  const uf = params.get("uf");
  const cargo = cargoPorCodigo(params.get("cargo") ?? "") ?? CARGO_PADRAO;

  if (uf && !ehUfValida(uf)) {
    return NextResponse.json({ erro: `UF inválida: ${uf}` }, { status: 400 });
  }

  try {
    const bruto = await buscarTse<RawMunicipiosConfig>(
      urlMunicipios(cargo.eleicao),
      REVALIDATE.config,
    );
    const todos = normalizarMunicipios(bruto);
    const municipios = uf
      ? todos.filter((m) => m.uf === uf.toLowerCase())
      : todos;

    return NextResponse.json(
      { total: municipios.length, municipios },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao consultar o TSE." },
      { status: 502 },
    );
  }
}
