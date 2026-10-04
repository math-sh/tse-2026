/**
 * Baixa a malha das 27 UFs do IBGE e grava em data/malha-uf.json.
 *
 * Roda uma vez (`npm run malha`), não em runtime: a geometria das unidades
 * federativas não muda, e o mapa não deve depender da disponibilidade do IBGE
 * justamente no dia da eleição.
 *
 * `properties.codarea` é o código IBGE da UF ("11".."53"), que lib/tse/ufs.ts
 * traduz para a sigla usada pelo TSE.
 *
 * ORIENTAÇÃO DOS ANÉIS: o IBGE segue o RFC 7946 (anel externo anti-horário),
 * mas o d3-geo trabalha na esfera e espera o contrário. Sem corrigir, o d3 lê
 * cada estado como "o globo inteiro menos o estado" e o mapa vira um retângulo
 * cheio. A regra: se a área esférica passa de meio globo, o polígono está
 * invertido — inverte os anéis.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoArea } from "d3-geo";

const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR" +
  "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF";

const DESTINO = resolve(import.meta.dirname, "..", "data", "malha-uf.json");

const inverterAneis = (geometria) => {
  if (geometria.type === "Polygon") {
    return { ...geometria, coordinates: geometria.coordinates.map((anel) => [...anel].reverse()) };
  }
  if (geometria.type === "MultiPolygon") {
    return {
      ...geometria,
      coordinates: geometria.coordinates.map((poligono) => poligono.map((anel) => [...anel].reverse())),
    };
  }
  return geometria;
};

const resposta = await fetch(URL_IBGE);
if (!resposta.ok) {
  console.error(`IBGE respondeu ${resposta.status}. Malha não atualizada.`);
  process.exit(1);
}

const geojson = await resposta.json();
let corrigidas = 0;
const features = (geojson.features ?? [])
  .map((f) => {
    const feature = {
      type: "Feature",
      properties: { codarea: String(f.properties.codarea) },
      geometry: f.geometry,
    };
    if (geoArea(feature) > 2 * Math.PI) {
      feature.geometry = inverterAneis(feature.geometry);
      corrigidas++;
    }
    return feature;
  })
  .sort((a, b) => a.properties.codarea.localeCompare(b.properties.codarea));

if (features.length !== 27) {
  console.error(`Esperava 27 unidades federativas, recebi ${features.length}. Abortando.`);
  process.exit(1);
}

const invertidas = features.filter((f) => geoArea(f) > 2 * Math.PI).length;
if (invertidas > 0) {
  console.error(`${invertidas} UFs continuam com área maior que meio globo. Abortando.`);
  process.exit(1);
}

const json = JSON.stringify({ type: "FeatureCollection", features });
writeFileSync(DESTINO, json);
console.log(
  `Malha gravada: ${features.length} UFs (${corrigidas} com anéis reorientados), ` +
    `${(json.length / 1024).toFixed(0)} KB → data/malha-uf.json`,
);
