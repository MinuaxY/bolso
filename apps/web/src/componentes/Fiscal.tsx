import {
  ATIVIDADES,
  AVISO_ATIVIDADES,
  TABELA_SIMPLES,
  anexoPorFatorR,
  atividadePorCnae,
  calcularDas,
  calcularDasMei,
  calcularFatorRBase,
  compararDas,
  somarMeses,
} from '@bolso/core';
import type { Anexo, AtividadeMei, AvisoSimples, Competencia, Lancamento } from '@bolso/core';
import { analisarValorCentavos } from '@bolso/parsers';
import { useMemo, useState } from 'react';

import type { Ajustes } from '../armazenamento.js';
import { formatarCentavos, formatarPercentual, nomeCompetencia } from '../formato.js';

const NOME_DO_AVISO: Record<AvisoSimples, string> = {
  'acima-do-teto':
    'A receita dos últimos 12 meses passou do teto do Simples. Acima disso a empresa é excluída do regime, e esta conta deixa de valer.',
  'acima-do-sublimite':
    'Acima do sublimite estadual: ICMS e ISS saem do DAS e são recolhidos à parte. O valor abaixo cobre só o que fica no DAS.',
  'rbt12-proporcional':
    'A receita de 12 meses foi estimada, porque não há um ano inteiro de histórico aqui.',
  'sem-historico':
    'Sem receita nos 12 meses anteriores, a conta usa a alíquota cheia da primeira faixa. Confira o histórico antes de comparar.',
};

/** Campo de dinheiro que aceita o jeito brasileiro de escrever. */
function CampoDinheiro({
  rotulo,
  valorCentavos,
  aoMudar,
  dica,
}: {
  rotulo: string;
  valorCentavos: number;
  aoMudar: (centavos: number) => void;
  dica?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valorCentavos / 100).toFixed(2).replace('.', ',');

  return (
    <label className="campo">
      {rotulo}
      <input
        type="text"
        inputMode="decimal"
        value={mostrado}
        onChange={(evento) => {
          setTexto(evento.target.value);
          const centavos = analisarValorCentavos(evento.target.value);
          if (centavos !== null && centavos >= 0) aoMudar(centavos);
        }}
        onBlur={() => {
          setTexto(null);
        }}
      />
      {dica !== undefined && <small>{dica}</small>}
    </label>
  );
}

export function Fiscal({
  lancamentos,
  competencia,
  ajustes,
  aoSalvar,
}: {
  lancamentos: readonly Lancamento[];
  competencia: Competencia;
  ajustes: Ajustes;
  aoSalvar: (ajustes: Ajustes) => Promise<void>;
}) {
  const fiscal = ajustes.fiscal;
  const [cobradoCentavos, setCobradoCentavos] = useState(0);

  const salvarFiscal = (mudanca: Partial<Ajustes['fiscal']>): void => {
    void aoSalvar({ ...ajustes, fiscal: { ...fiscal, ...mudanca } });
  };

  /** Receita reconhecida em cada competência, para montar RBT12 e o mês. */
  const receitaPorMes = useMemo(() => {
    const mapa = new Map<Competencia, number>();
    for (const lancamento of lancamentos) {
      if (lancamento.tipo !== 'receita' || lancamento.natureza !== undefined) continue;
      mapa.set(lancamento.competencia, (mapa.get(lancamento.competencia) ?? 0) + lancamento.valorCentavos);
    }
    return mapa;
  }, [lancamentos]);

  const receitaDoMesImportada = receitaPorMes.get(competencia) ?? 0;

  const { rbt12Importado, mesesComDados } = useMemo(() => {
    let soma = 0;
    let meses = 0;
    for (let i = 1; i <= 12; i++) {
      const mes = somarMeses(competencia, -i);
      const valor = receitaPorMes.get(mes);
      if (valor !== undefined) {
        soma += valor;
        meses++;
      }
    }
    return { rbt12Importado: soma, mesesComDados: meses };
  }, [receitaPorMes, competencia]);

  const [receitaMes, setReceitaMes] = useState<number | null>(null);
  const [rbt12, setRbt12] = useState<number | null>(null);

  const receitaFinal = receitaMes ?? receitaDoMesImportada;
  const rbt12Final = rbt12 ?? rbt12Importado;

  const atividade = ATIVIDADES.find((a) => a.id === fiscal.atividadeId);

  // A atividade escolhida manda; sem ela, valem o anexo e a caixa do Fator R
  // que a pessoa marcou na mao.
  const sujeitoAoFatorR = atividade?.fatorR ?? fiscal.sujeitoAoFatorR;
  const anexoBase: Anexo = atividade?.anexo ?? fiscal.anexo;

  const anexoEfetivo: Anexo = sujeitoAoFatorR
    ? anexoPorFatorR(fiscal.folha12Centavos, rbt12Final)
    : anexoBase;

  const fatorRPercentual = calcularFatorRBase(fiscal.folha12Centavos, rbt12Final) / 100;

  const resultado = useMemo(
    () =>
      calcularDas({
        receitaMesCentavos: receitaFinal,
        rbt12Centavos: rbt12Final,
        anexo: anexoEfetivo,
        ...(mesesComDados > 0 && mesesComDados < 12 ? { rbt12Estimado: true } : {}),
      }),
    [receitaFinal, rbt12Final, anexoEfetivo, mesesComDados],
  );

  const dasMei = calcularDasMei(fiscal.atividadeMei);
  const calculado = fiscal.regime === 'mei' ? dasMei : resultado.dasCentavos;
  const comparacao = compararDas(calculado, cobradoCentavos);

  if (fiscal.regime === 'nenhum') {
    return (
      <section className="cartao">
        <h2>Conferência do DAS</h2>
        <p>
          Se você tem CNPJ no Simples Nacional ou é MEI, o Bolso refaz a conta do DAS para você
          comparar com o que o contador cobrou.
        </p>
        <p className="nota">
          Isto não substitui contador e não emite guia. Serve para você conferir — e para ter uma
          pergunta concreta a fazer quando o valor não bater.
        </p>
        <div className="acoes">
          <button
            type="button"
            className="principal"
            onClick={() => {
              salvarFiscal({ regime: 'simples' });
            }}
          >
            Tenho empresa no Simples
          </button>
          <button
            type="button"
            onClick={() => {
              salvarFiscal({ regime: 'mei' });
            }}
          >
            Sou MEI
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="pilha">
      <section className="cartao alerta">
        <h3>Isto é conferência, não é a sua guia</h3>
        <p>
          O cálculo segue a tabela do Simples Nacional de {TABELA_SIMPLES.anoVigencia}. Ele não
          substitui o contador, não emite DAS e não considera a situação inteira da sua empresa —
          retenções, sublimites estaduais, atividades misturadas no mesmo CNPJ. Use para comparar e
          para perguntar.
        </p>
      </section>

      <section className="cartao">
        <div className="barra-ferramentas">
          <h2>{fiscal.regime === 'mei' ? 'DAS do MEI' : 'DAS do Simples'}</h2>
          <select
            value={fiscal.regime}
            onChange={(evento) => {
              salvarFiscal({ regime: evento.target.value as 'nenhum' | 'simples' | 'mei' });
            }}
          >
            <option value="simples">Simples Nacional</option>
            <option value="mei">MEI</option>
            <option value="nenhum">Não tenho empresa</option>
          </select>
        </div>

        {fiscal.regime === 'mei' ? (
          <>
            <label className="campo">
              Atividade
              <select
                value={fiscal.atividadeMei}
                onChange={(evento) => {
                  salvarFiscal({ atividadeMei: evento.target.value as AtividadeMei });
                }}
              >
                <option value="comercio-industria">Comércio ou indústria</option>
                <option value="servicos">Serviços</option>
                <option value="comercio-e-servicos">Comércio e serviços</option>
              </select>
              <small>
                O DAS do MEI é fixo: 5% do salário mínimo de INSS, mais R$ 1,00 de ICMS no comércio
                e R$ 5,00 de ISS nos serviços.
              </small>
            </label>
            <div className="indicadores">
              <div className="indicador">
                <span className="indicador-rotulo">DAS por mês</span>
                <strong className="indicador-valor num">{formatarCentavos(dasMei)}</strong>
                <span className="indicador-detalhe">
                  salário mínimo de {formatarCentavos(TABELA_SIMPLES.mei.salarioMinimoCentavos)}
                </span>
              </div>
              <div className="indicador">
                <span className="indicador-rotulo">Teto do MEI no ano</span>
                <strong className="indicador-valor num">
                  {formatarCentavos(TABELA_SIMPLES.mei.limiteAnualCentavos)}
                </strong>
                <span className="indicador-detalhe">acima disso, migra para o Simples</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="duas-colunas">
              <CampoDinheiro
                rotulo={`Faturamento de ${nomeCompetencia(competencia)}`}
                valorCentavos={receitaFinal}
                aoMudar={setReceitaMes}
                dica={
                  receitaDoMesImportada > 0
                    ? `Veio das receitas importadas deste mês. Corrija se a conta mistura pessoa física e jurídica.`
                    : 'Digite o faturamento do mês da empresa.'
                }
              />
              <CampoDinheiro
                rotulo="Receita dos 12 meses anteriores (RBT12)"
                valorCentavos={rbt12Final}
                aoMudar={setRbt12}
                dica={
                  mesesComDados > 0
                    ? `Somado de ${String(mesesComDados)} ${mesesComDados === 1 ? 'mês importado' : 'meses importados'}.`
                    : 'Sem histórico importado — digite o valor.'
                }
              />
            </div>

            <label className="campo">
              O que a sua empresa faz
              <input
                type="text"
                placeholder="Digite o CNAE ou o que a empresa faz"
                onChange={(evento) => {
                  const achada = atividadePorCnae(evento.target.value);
                  if (achada !== undefined) salvarFiscal({ atividadeId: achada.id });
                }}
              />
              <select
                value={fiscal.atividadeId ?? ''}
                onChange={(evento) => {
                  salvarFiscal({ atividadeId: evento.target.value === '' ? null : evento.target.value });
                }}
              >
                <option value="">Outra atividade — escolho o anexo na mão</option>
                {(['I', 'II', 'III', 'IV', 'V'] as const).map((anexo) => (
                  <optgroup key={anexo} label={`Anexo ${anexo}`}>
                    {ATIVIDADES.filter((a) => a.anexo === anexo).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {atividade === undefined ? (
                <small>
                  Digitar o CNAE preenche a lista sozinho. Se a sua atividade não estiver aqui,
                  escolha o anexo abaixo — e confirme com o contador.
                </small>
              ) : (
                <small>
                  {atividade.exemplos}. Anexo {atividade.anexo}
                  {atividade.fatorR ? ', sujeito ao Fator R' : ', sem Fator R'} — {atividade.fundamento}.
                </small>
              )}
            </label>

            <details>
              <summary>Por que o Bolso pergunta em vez de descobrir pelo CNPJ</summary>
              <p className="nota">
                A lei classifica pela descrição da atividade, não pelo código CNAE, e não existe
                tabela oficial de CNAE para anexo — os anexos da Resolução CGSN 140/2018 que listam
                CNAEs dizem quem <em>pode entrar</em> no Simples, não em que anexo cada um cai. A
                lista acima é interpretação das atividades mais comuns: serve para orientar, e o
                contador confirma. Consultar o seu CNPJ numa API resolveria parte disso, mas exigiria
                mandar o seu CNPJ para um serviço de terceiro — e este app não faz requisição de
                rede nenhuma, de propósito.
              </p>
              <p className="nota">{AVISO_ATIVIDADES}</p>
            </details>

            {sujeitoAoFatorR ? (
              <CampoDinheiro
                rotulo="Folha de pagamento dos últimos 12 meses"
                valorCentavos={fiscal.folha12Centavos}
                aoMudar={(centavos) => {
                  salvarFiscal({ folha12Centavos: centavos });
                }}
                dica={`Fator R hoje: ${formatarPercentual(fatorRPercentual)} — ${
                  anexoEfetivo === 'III' ? 'Anexo III' : 'Anexo V'
                }`}
              />
            ) : atividade !== undefined ? (
              <p className="nota">
                Anexo {anexoBase} não usa Fator R: a folha de pagamento não muda o imposto aqui.
              </p>
            ) : (
              <label className="campo">
                Anexo
                <select
                  value={fiscal.anexo}
                  onChange={(evento) => {
                    salvarFiscal({ anexo: evento.target.value as Anexo });
                  }}
                >
                  {(['I', 'II', 'III', 'IV', 'V'] as const).map((anexo) => (
                    <option key={anexo} value={anexo}>
                      Anexo {anexo} — {TABELA_SIMPLES.anexos[anexo].nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="indicadores">
              <div className="indicador">
                <span className="indicador-rotulo">Alíquota efetiva</span>
                <strong className="indicador-valor num">
                  {formatarPercentual(resultado.aliquotaEfetivaPercentual)}
                </strong>
                <span className="indicador-detalhe">
                  Anexo {resultado.anexo}, {resultado.faixa}ª faixa
                </span>
              </div>
              <div className="indicador">
                <span className="indicador-rotulo">DAS calculado</span>
                <strong className="indicador-valor num tom-negativo">
                  {formatarCentavos(resultado.dasCentavos)}
                </strong>
                <span className="indicador-detalhe">
                  nominal {formatarPercentual(resultado.aliquotaNominalPercentual)}, deduz{' '}
                  {formatarCentavos(resultado.deduzirCentavos)}
                </span>
              </div>
            </div>

            <details>
              <summary>Como esta conta foi feita</summary>
              <p className="nota">
                Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12, e o DAS é
                o faturamento do mês vezes essa alíquota. Com RBT12 de{' '}
                {formatarCentavos(rbt12Final)} no Anexo {resultado.anexo}, a nominal é{' '}
                {formatarPercentual(resultado.aliquotaNominalPercentual)} e a parcela a deduzir é{' '}
                {formatarCentavos(resultado.deduzirCentavos)} — o que dá{' '}
                {formatarPercentual(resultado.aliquotaEfetivaPercentual)} sobre{' '}
                {formatarCentavos(receitaFinal)}.
              </p>
            </details>

            {resultado.avisos.map((aviso) => (
              <p key={aviso} className="erro-texto">
                {NOME_DO_AVISO[aviso]}
              </p>
            ))}
          </>
        )}
      </section>

      <section className="cartao">
        <h3>Comparar com o que foi cobrado</h3>
        <CampoDinheiro
          rotulo="Valor do DAS que você recebeu para pagar"
          valorCentavos={cobradoCentavos}
          aoMudar={setCobradoCentavos}
        />

        {cobradoCentavos > 0 && (
          <div className={`cartao ${comparacao.veredito === 'confere' ? 'sucesso' : 'alerta'}`}>
            {comparacao.veredito === 'confere' ? (
              <p>
                <strong>Bate.</strong> O valor cobrado é o mesmo que esta conta dá.
              </p>
            ) : (
              <>
                <p>
                  <strong>
                    Diferença de {formatarCentavos(Math.abs(comparacao.diferencaCentavos))}
                  </strong>{' '}
                  ({comparacao.diferencaPercentual > 0 ? '+' : ''}
                  {formatarPercentual(comparacao.diferencaPercentual, 1)}) — cobraram{' '}
                  {comparacao.veredito === 'cobrou-a-mais' ? 'a mais' : 'a menos'} do que esta conta
                  prevê.
                </p>
                <p className="nota">
                  Divergência não quer dizer erro: retenção na fonte, atividade em anexo diferente,
                  receita de outro mês ou parcelamento mudam o valor. É uma pergunta para levar ao
                  contador, não uma acusação.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
