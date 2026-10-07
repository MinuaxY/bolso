import { competenciasDisponiveis, custoAnualCentavos, detectarAssinaturas } from '@bolso/core';
import type { Assinatura, Lancamento } from '@bolso/core';
import { useMemo } from 'react';

import { formatarCentavos, nomeCompetencia, plural } from '../formato.js';

/** O mesmo minimo do nucleo. Aqui so para explicar na tela o que falta. */
const MESES_NECESSARIOS = 3;

/**
 * As etiquetas ao lado do nome.
 *
 * A do atraso existe por causa de um caso visto na propria tela: o nucleo da
 * um mes de folga antes de declarar encerrada uma assinatura, porque a
 * cobranca do mes pode so nao ter caido ainda. Consequencia: uma assinatura
 * cancelada no mes passado continua somando no custo do ano por mais um mes.
 * A folga esta certa — mas esconder isso nao: quem olha precisa ver que a
 * ultima cobranca nao e deste mes e decidir sozinho.
 */
function Situacao({
  assinatura,
  competenciaAtual,
}: {
  assinatura: Assinatura;
  competenciaAtual: string;
}) {
  if (assinatura.situacao === 'encerrada') {
    return (
      <span className="etiqueta etiqueta-suave">
        parou em {nomeCompetencia(assinatura.ultimaCompetencia)}
      </span>
    );
  }

  const atrasada = assinatura.ultimaCompetencia !== competenciaAtual;

  return (
    <>
      {assinatura.aumentoCentavos !== undefined && (
        <span className="etiqueta etiqueta-alerta">
          subiu {formatarCentavos(assinatura.aumentoCentavos)}
        </span>
      )}
      <span className="etiqueta etiqueta-suave">
        {atrasada
          ? `última em ${nomeCompetencia(assinatura.ultimaCompetencia)}`
          : plural(assinatura.meses, 'mês', 'meses')}
      </span>
    </>
  );
}

/**
 * Nao achou nada. Explicar por que importa mais do que a lista vazia: quem
 * importou uma fatura so e concluiu que o modulo nao funciona nao volta.
 */
function Vazio({ meses }: { meses: number }) {
  if (meses < MESES_NECESSARIOS) {
    return (
      <>
        <p className="vazio">
          Ainda não dá para afirmar que alguma cobrança se repete. Você importou{' '}
          {plural(meses, 'mês', 'meses')}, e eu preciso de {MESES_NECESSARIOS} para distinguir uma
          assinatura de uma compra que por acaso aconteceu duas vezes.
        </p>
        <p className="nota">
          Assinatura quase sempre cai no cartão de crédito — então o que falta costuma ser importar
          as faturas dos meses anteriores, não o extrato da conta.
        </p>
      </>
    );
  }
  return (
    <p className="vazio">
      Nenhuma cobrança mensal repetida nos {plural(meses, 'mês importado', 'meses importados')}.
      Parcelamento não conta aqui: ele aparece logo acima, em “Parcelamentos em aberto”.
    </p>
  );
}

export function Assinaturas({ lancamentos }: { lancamentos: readonly Lancamento[] }) {
  const assinaturas = useMemo(() => detectarAssinaturas(lancamentos), [lancamentos]);
  const competencias = useMemo(() => competenciasDisponiveis(lancamentos), [lancamentos]);
  const meses = competencias.length;
  // `competenciasDisponiveis` devolve da mais recente para a mais antiga.
  const competenciaAtual = competencias[0] ?? '';

  const anualCentavos = custoAnualCentavos(assinaturas);
  const ativas = assinaturas.filter((a) => a.situacao === 'ativa');
  const mensalCentavos = ativas.reduce((soma, a) => soma + a.valorCentavos, 0);
  const subiram = ativas.filter((a) => a.aumentoCentavos !== undefined);

  return (
    <section className={assinaturas.length > 0 ? 'cartao destaque' : 'cartao'}>
      <h3>Assinaturas</h3>

      {assinaturas.length === 0 ? (
        <Vazio meses={meses} />
      ) : (
        <>
          <p className="nota">
            Cobranças que se repetem todo mês, no mesmo lugar e pelo mesmo valor. Ninguém cancela
            por causa do valor do mês — por isso o número que importa aqui é o do ano.
          </p>

          <div className="indicadores">
            <div className="indicador">
              <span className="indicador-rotulo">Por ano</span>
              <strong className="indicador-valor num tom-negativo">
                {formatarCentavos(anualCentavos)}
              </strong>
              <span className="indicador-detalhe">
                mantido o preço de hoje, em {plural(ativas.length, 'assinatura', 'assinaturas')}
              </span>
            </div>
            <div className="indicador">
              <span className="indicador-rotulo">Por mês</span>
              <strong className="indicador-valor num tom-negativo">
                {formatarCentavos(mensalCentavos)}
              </strong>
              <span className="indicador-detalhe">sai do seu bolso todo mês, sem você decidir</span>
            </div>
          </div>

          {subiram.length > 0 && (
            <p className="nota">
              {subiram.length === 1
                ? `${subiram[0]?.descricao ?? ''} está cobrando mais do que cobrava quando começou.`
                : `${String(subiram.length)} delas estão cobrando mais do que cobravam quando começaram.`}
            </p>
          )}

          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Assinatura</th>
                  <th>Categoria</th>
                  <th className="direita">Por mês</th>
                  <th className="direita">Por ano</th>
                  <th className="direita">Já paguei</th>
                  <th>Desde</th>
                </tr>
              </thead>
              <tbody>
                {assinaturas.map((assinatura) => (
                  <tr
                    key={assinatura.descricao}
                    className={assinatura.situacao === 'encerrada' ? 'linha-apagada' : undefined}
                  >
                    <td>
                      {assinatura.descricao}
                      <Situacao assinatura={assinatura} competenciaAtual={competenciaAtual} />
                    </td>
                    <td>{assinatura.categoria}</td>
                    <td className="num direita">{formatarCentavos(assinatura.valorCentavos)}</td>
                    <td className="num direita">
                      {assinatura.situacao === 'ativa'
                        ? formatarCentavos(assinatura.anualCentavos)
                        : '—'}
                    </td>
                    <td className="num direita">
                      {formatarCentavos(assinatura.totalPagoCentavos)}
                    </td>
                    <td>{nomeCompetencia(assinatura.primeiraCompetencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="nota">
            “Já paguei” conta só o que está importado — não a vida inteira da assinatura. Cobrança
            anual não entra nesta lista: uma vez por ano não dá para distinguir de uma compra
            avulsa.
          </p>
        </>
      )}
    </section>
  );
}
