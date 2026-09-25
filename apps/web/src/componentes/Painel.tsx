import { comprometimentoFuturo, evolucaoMensal, resumirMes } from '@bolso/core';
import type { Competencia, Lancamento, Meta } from '@bolso/core';
import { useMemo } from 'react';

import { formatarCentavos, nomeCompetencia, plural } from '../formato.js';
import { BarrasHorizontais, EvolucaoMensal } from './Graficos.js';
import { ResumoDeMetas } from './Metas.js';

function Indicador({
  rotulo,
  valorCentavos,
  detalhe,
  tom,
}: {
  rotulo: string;
  valorCentavos: number;
  detalhe?: string;
  tom?: 'positivo' | 'negativo' | 'neutro';
}) {
  const tomFinal = tom ?? (valorCentavos >= 0 ? 'positivo' : 'negativo');

  return (
    <div className="indicador">
      <span className="indicador-rotulo">{rotulo}</span>
      <strong className={`indicador-valor num tom-${tomFinal}`}>
        {formatarCentavos(valorCentavos)}
      </strong>
      {detalhe !== undefined && <span className="indicador-detalhe">{detalhe}</span>}
    </div>
  );
}

export function Painel({
  lancamentos,
  competencia,
  metas,
}: {
  lancamentos: readonly Lancamento[];
  competencia: Competencia;
  metas: readonly Meta[];
}) {
  const resumo = useMemo(() => resumirMes(lancamentos, competencia), [lancamentos, competencia]);
  const evolucao = useMemo(() => evolucaoMensal(lancamentos), [lancamentos]);
  const futuro = useMemo(() => comprometimentoFuturo(lancamentos, 6), [lancamentos]);

  const proximo = futuro[0];

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>{nomeCompetencia(competencia)}</h2>
        <div className="indicadores">
          <Indicador
            rotulo="Gastei"
            valorCentavos={resumo.despesasPagasCentavos}
            tom="negativo"
            detalhe={plural(resumo.quantidade, 'lançamento no mês', 'lançamentos no mês')}
          />
          <Indicador
            rotulo="Recebi"
            valorCentavos={resumo.receitasRecebidasCentavos}
            tom="positivo"
          />
          <Indicador
            rotulo="Sobrou"
            valorCentavos={resumo.saldoRealizadoCentavos}
            detalhe={
              resumo.despesasPendentesCentavos > 0
                ? `ainda vencem ${formatarCentavos(resumo.despesasPendentesCentavos)}`
                : 'nada pendente'
            }
          />
          <Indicador
            rotulo="Previsto no fim do mês"
            valorCentavos={resumo.saldoPrevistoCentavos}
            detalhe="contando o que ainda vai acontecer"
          />
        </div>

        {resumo.transferenciasCentavos > 0 && (
          <p className="nota">
            {formatarCentavos(resumo.transferenciasCentavos)} em transferências entre suas próprias
            contas ficaram de fora das somas — é o mesmo dinheiro mudando de lugar, como o
            pagamento da fatura.
          </p>
        )}
      </section>

      <ResumoDeMetas lancamentos={lancamentos} competencia={competencia} metas={metas} />

      <div className="duas-colunas">
        <section className="cartao">
          <h3>Para onde foi</h3>
          <BarrasHorizontais linhas={resumo.porCategoria} />
        </section>

        <section className="cartao">
          <h3>Como paguei</h3>
          <BarrasHorizontais linhas={resumo.porFormaPagamento} limite={6} />
        </section>
      </div>

      <section className="cartao">
        <h3>Mês a mês</h3>
        <EvolucaoMensal pontos={evolucao} />
      </section>

      {proximo !== undefined && (
        <section className="cartao destaque">
          <h3>Já comprometido</h3>
          <p>
            <strong className="num">{formatarCentavos(proximo.centavos)}</strong> das próximas
            faturas já estão gastos em parcelamento, começando por{' '}
            {nomeCompetencia(proximo.competencia)}.
          </p>
          <ul className="futuro">
            {futuro.map((compromisso) => (
              <li key={compromisso.competencia}>
                <span>{nomeCompetencia(compromisso.competencia)}</span>
                <span className="num">{formatarCentavos(compromisso.centavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
