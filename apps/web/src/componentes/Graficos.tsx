/**
 * Graficos desenhados a mao, em SVG.
 *
 * Sem biblioteca de grafico: sao duas formas simples, e uma dependencia de
 * 200 kB num app que le extrato bancario custa mais do que economiza.
 */

import type { LinhaAgrupada, PontoMensal } from '@bolso/core';

import { competenciaCurta, formatarCentavos } from '../formato.js';

export function BarrasHorizontais({
  linhas,
  limite = 8,
}: {
  linhas: readonly LinhaAgrupada[];
  limite?: number;
}) {
  const visiveis = linhas.filter((linha) => linha.centavos > 0).slice(0, limite);
  const maior = visiveis[0]?.centavos ?? 0;

  if (visiveis.length === 0) {
    return <p className="vazio">Nada para mostrar neste mês.</p>;
  }

  return (
    <ul className="barras">
      {visiveis.map((linha) => (
        <li key={linha.chave}>
          <div className="barras-topo">
            <span className="barras-nome">{linha.chave}</span>
            <span className="barras-valor num">{formatarCentavos(linha.centavos)}</span>
          </div>
          <div className="barras-trilho">
            <div
              className="barras-preenchimento"
              style={{ width: `${String(maior > 0 ? (linha.centavos / maior) * 100 : 0)}%` }}
            />
          </div>
          <span className="barras-detalhe">
            {linha.quantidade === 1 ? '1 lançamento' : `${String(linha.quantidade)} lançamentos`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EvolucaoMensal({ pontos }: { pontos: readonly PontoMensal[] }) {
  const ultimos = pontos.slice(-12);

  if (ultimos.length === 0) {
    return <p className="vazio">Importe mais de um mês para ver a evolução.</p>;
  }

  const maior = Math.max(
    ...ultimos.map((ponto) => Math.max(ponto.despesasCentavos, ponto.receitasCentavos)),
    1,
  );

  const largura = 100 / ultimos.length;

  return (
    <div className="grafico-rolagem">
      <svg
        className="evolucao"
        viewBox="0 0 100 46"
        preserveAspectRatio="none"
        role="img"
        aria-label="Despesas e receitas por mês"
      >
        {[0.25, 0.5, 0.75].map((fracao) => (
          <line
            key={fracao}
            x1="0"
            x2="100"
            y1={String(40 - 40 * fracao)}
            y2={String(40 - 40 * fracao)}
            className="evolucao-grade"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {ultimos.map((ponto, indice) => {
          const x = indice * largura;
          const alturaDespesa = (ponto.despesasCentavos / maior) * 40;
          const alturaReceita = (ponto.receitasCentavos / maior) * 40;
          const larguraBarra = largura * 0.32;

          return (
            <g key={ponto.competencia}>
              <rect
                x={String(x + largura * 0.14)}
                y={String(40 - alturaReceita)}
                width={String(larguraBarra)}
                height={String(alturaReceita)}
                className="evolucao-receita"
              />
              <rect
                x={String(x + largura * 0.52)}
                y={String(40 - alturaDespesa)}
                width={String(larguraBarra)}
                height={String(alturaDespesa)}
                className="evolucao-despesa"
              />
            </g>
          );
        })}
      </svg>

      <div className="evolucao-eixo" style={{ gridTemplateColumns: `repeat(${String(ultimos.length)}, 1fr)` }}>
        {ultimos.map((ponto) => (
          <span key={ponto.competencia}>{competenciaCurta(ponto.competencia)}</span>
        ))}
      </div>

      <p className="legenda">
        <span className="ponto ponto-receita" /> Receitas
        <span className="ponto ponto-despesa" /> Despesas
      </p>
    </div>
  );
}
