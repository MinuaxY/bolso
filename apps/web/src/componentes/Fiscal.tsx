import {
  ATIVIDADES,
  AVISO_ATIVIDADES,
  TABELA_SIMPLES,
  anexoPorFatorR,
  atividadePorCnae,
  calcularDas,
  calcularDasMei,
  calcularFatorRBase,
  calcularProLabore,
  compararDas,
  dasPorAliquota,
  receitasPorCompetencia,
  somarMeses,
  temEscopoMarcado,
} from '@bolso/core';
import type { Anexo, AtividadeMei, AvisoSimples, Competencia, Lancamento } from '@bolso/core';
import { analisarValorCentavos } from '@bolso/parsers';
import { useEffect, useMemo, useState } from 'react';

import type { Ajustes } from '../armazenamento.js';
import { carregarCnaes, descricaoDoCnae } from '../cnae.js';
import type { TabelaCnae } from '../cnae.js';
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
  'iss-no-teto':
    'Nesta faixa o ISS chega ao teto de 5% e a lei redistribui a diferença entre os tributos federais. O Bolso ainda não faz essa redistribuição, então mostra o total sem a divisão por tributo — e o valor pode diferir alguns centavos da guia.',
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
  const [cnaeDigitado, setCnaeDigitado] = useState('');
  const [tabelaCnae, setTabelaCnae] = useState<TabelaCnae | null>(null);

  // A tabela do IBGE viaja no app, mas so e carregada quando esta tela abre:
  // sao 21 kB que quem nunca usa o modulo fiscal nao precisa baixar.
  useEffect(() => {
    let vivo = true;
    void carregarCnaes().then((tabela) => {
      if (vivo) setTabelaCnae(tabela);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const salvarFiscal = (mudanca: Partial<Ajustes['fiscal']>): void => {
    void aoSalvar({ ...ajustes, fiscal: { ...fiscal, ...mudanca } });
  };

  // A partir do primeiro lancamento marcado como da empresa, o modulo fiscal
  // passa a somar so o que e dela. Antes disso soma tudo e avisa — porque
  // exigir a separacao antes de mostrar qualquer numero seria empurrar
  // trabalho para quem ainda nem sabe se a ferramenta serve.
  const separado = useMemo(() => temEscopoMarcado(lancamentos), [lancamentos]);
  const receitaPorMes = useMemo(
    () => receitasPorCompetencia(lancamentos, separado ? 'empresa' : undefined),
    [lancamentos, separado],
  );

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
  const descricaoCnae = descricaoDoCnae(cnaeDigitado, tabelaCnae);
  const cnaeSemResposta =
    descricaoCnae === null && cnaeDigitado.replace(/\D/g, '').length === 7 && tabelaCnae !== null;

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

  // Quanto o Fator R esta custando ou economizando: a mesma receita no outro
  // anexo. E o numero que faz a pessoa entender por que o pro-labore importa.
  const anexoOposto: Anexo = anexoEfetivo === 'III' ? 'V' : 'III';
  const dasNoOutroAnexo = calcularDas({
    receitaMesCentavos: receitaFinal,
    rbt12Centavos: rbt12Final,
    anexo: anexoOposto,
  }).dasCentavos;
  const diferencaEntreAnexos = Math.abs(dasNoOutroAnexo - resultado.dasCentavos);
  const folhaMinimaCentavos = Math.ceil(
    (rbt12Final * TABELA_SIMPLES.fatorRMinimoBase) / 10000,
  );

  const retirada = calcularProLabore({
    proLaboreCentavos: fiscal.proLaboreCentavos,
    ...(anexoEfetivo === 'IV' ? { anexoIV: true } : {}),
  });

  const dasMei = calcularDasMei(fiscal.atividadeMei);

  // A aliquota informada a mao vence a nossa conta: quem sabe a propria
  // aliquota sabe mais sobre a propria empresa do que a nossa leitura do anexo.
  const dasDoSimples =
    fiscal.aliquotaManualBase === null
      ? resultado.dasCentavos
      : dasPorAliquota(receitaFinal, fiscal.aliquotaManualBase);

  const calculado = fiscal.regime === 'mei' ? dasMei : dasDoSimples;
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
                  receitaDoMesImportada === 0
                    ? 'Digite o faturamento do mês da empresa.'
                    : separado
                      ? 'Somado das receitas que você marcou como da empresa no extrato.'
                      : 'Veio de TODAS as receitas importadas deste mês. Marque no extrato quais são da empresa para separar — a coluna PF/PJ faz isso com um clique.'
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
                value={cnaeDigitado}
                onChange={(evento) => {
                  setCnaeDigitado(evento.target.value);
                  const achada = atividadePorCnae(evento.target.value);
                  if (achada !== undefined) salvarFiscal({ atividadeId: achada.id });
                }}
              />
              {descricaoCnae !== null && (
                <small className="sucesso-texto">
                  IBGE: {descricaoCnae}
                  {atividadePorCnae(cnaeDigitado) === undefined &&
                    ' — conheço este código, mas não sei em que anexo ele cai. Escolha abaixo.'}
                </small>
              )}
              {cnaeSemResposta && (
                <small className="erro-texto">
                  Não achei este código na tabela do IBGE. Confira no cartão CNPJ.
                </small>
              )}
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
                  {formatarPercentual(
                    fiscal.aliquotaManualBase === null
                      ? resultado.aliquotaEfetivaPercentual
                      : fiscal.aliquotaManualBase / 100,
                  )}
                </strong>
                <span className="indicador-detalhe">
                  {fiscal.aliquotaManualBase === null
                    ? `Anexo ${resultado.anexo}, ${String(resultado.faixa)}ª faixa`
                    : 'informada por você'}
                </span>
              </div>
              <div className="indicador">
                <span className="indicador-rotulo">DAS calculado</span>
                <strong className="indicador-valor num tom-negativo">
                  {formatarCentavos(dasDoSimples)}
                </strong>
                <span className="indicador-detalhe">
                  nominal {formatarPercentual(resultado.aliquotaNominalPercentual)}, deduz{' '}
                  {formatarCentavos(resultado.deduzirCentavos)}
                </span>
              </div>
            </div>

            {sujeitoAoFatorR && rbt12Final > 0 && receitaFinal > 0 && (
              <div className={anexoEfetivo === 'III' ? 'cartao sucesso' : 'cartao alerta'}>
                {anexoEfetivo === 'III' ? (
                  <p>
                    <strong>O Fator R está economizando {formatarCentavos(diferencaEntreAnexos)} por mês.</strong>{' '}
                    Com a folha abaixo de 28% da receita, esta empresa cairia no Anexo V e este DAS
                    seria {formatarCentavos(dasNoOutroAnexo)} em vez de{' '}
                    {formatarCentavos(resultado.dasCentavos)}.
                  </p>
                ) : (
                  <p>
                    <strong>Faltam {formatarPercentual(28 - fatorRPercentual)} de folha para o Anexo III.</strong>{' '}
                    Com folha de 12 meses a partir de {formatarCentavos(folhaMinimaCentavos)} — hoje
                    são {formatarCentavos(fiscal.folha12Centavos)} — este DAS cairia para{' '}
                    {formatarCentavos(dasNoOutroAnexo)}, uma diferença de{' '}
                    {formatarCentavos(diferencaEntreAnexos)} por mês.
                  </p>
                )}
                <p className="nota">
                  Aumentar a retirada tem custo próprio: INSS e IRRF sobre o pró-labore. A conta
                  abaixo mostra os dois lados.
                </p>
              </div>
            )}

            {resultado.composicao.length > 0 && fiscal.aliquotaManualBase === null && (
              <details>
                <summary>Como este DAS se divide entre os tributos</summary>
                <p className="nota">
                  É a mesma composição impressa na guia. O total sai da soma das partes, tributo a
                  tributo — que é como a Receita calcula, e por isso ele pode diferir um centavo de
                  multiplicar faturamento por alíquota.
                </p>
                <div className="tabela-rolagem">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Tributo</th>
                        <th className="direita">Fatia da alíquota</th>
                        <th className="direita">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.composicao.map((parcela) => (
                        <tr key={parcela.tributo}>
                          <td>{parcela.nome}</td>
                          <td className="num direita">
                            {formatarPercentual(parcela.percentualDaAliquota)}
                          </td>
                          <td className="num direita">{formatarCentavos(parcela.centavos)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td />
                        <td className="num direita">
                          <strong>{formatarCentavos(resultado.dasCentavos)}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <details open={fiscal.aliquotaManualBase !== null}>
              <summary>Prefiro informar a alíquota efetiva eu mesmo</summary>
              <p className="nota">
                Se você já sabe a sua alíquota — ela aparece no extrato do PGDAS, junto do DAS —
                informe aqui e o Bolso usa a sua, não a dele. Serve para conferir o valor sem
                depender da nossa leitura do anexo, e para o caso de a sua atividade não estar na
                lista.
              </p>
              <div className="acoes">
                <label className="campo">
                  Alíquota efetiva (%)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="8,08"
                    value={
                      fiscal.aliquotaManualBase === null
                        ? ''
                        : (fiscal.aliquotaManualBase / 100).toFixed(2).replace('.', ',')
                    }
                    onChange={(evento) => {
                      const texto = evento.target.value.trim();
                      if (texto === '') {
                        salvarFiscal({ aliquotaManualBase: null });
                        return;
                      }
                      const centesimos = analisarValorCentavos(texto);
                      if (centesimos !== null && centesimos >= 0 && centesimos <= 10000) {
                        salvarFiscal({ aliquotaManualBase: centesimos });
                      }
                    }}
                  />
                  <small>Deixe em branco para voltar a usar a conta do Bolso.</small>
                </label>
              </div>
              {fiscal.aliquotaManualBase !== null && (
                <p className="sucesso-texto">
                  Usando a sua alíquota: {formatarPercentual(fiscal.aliquotaManualBase / 100)} sobre{' '}
                  {formatarCentavos(receitaFinal)} dá {formatarCentavos(dasDoSimples)}.
                </p>
              )}
            </details>

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

      {fiscal.regime === 'simples' && (
        <section className="cartao">
          <h2>Pró-labore do sócio</h2>
          <p className="nota">
            A retirada do sócio não está no DAS: ela gera DARF próprio. Estes são os dois que
            costumam chegar junto com o DAS todo mês.
          </p>

          <CampoDinheiro
            rotulo="Quanto você retira por mês"
            valorCentavos={fiscal.proLaboreCentavos}
            aoMudar={(centavos) => {
              salvarFiscal({ proLaboreCentavos: centavos });
            }}
            dica="Deixe em zero se você não retira pró-labore."
          />

          {fiscal.proLaboreCentavos > 0 && (
            <>
              <div className="indicadores">
                <div className="indicador">
                  <span className="indicador-rotulo">INSS — DARF 1099</span>
                  <strong className="indicador-valor num tom-negativo">
                    {formatarCentavos(retirada.inss.contribuicaoCentavos)}
                  </strong>
                  <span className="indicador-detalhe">11%, vence dia 20 do mês seguinte</span>
                </div>
                <div className="indicador">
                  <span className="indicador-rotulo">IRRF</span>
                  <strong className="indicador-valor num tom-negativo">
                    {formatarCentavos(retirada.irrf.impostoCentavos)}
                  </strong>
                  <span className="indicador-detalhe">
                    {retirada.irrf.impostoCentavos === 0
                      ? 'isento — nada a reter'
                      : 'vence no último dia útil do mês seguinte'}
                  </span>
                </div>
                <div className="indicador">
                  <span className="indicador-rotulo">Sobra na sua mão</span>
                  <strong className="indicador-valor num tom-positivo">
                    {formatarCentavos(retirada.liquidoCentavos)}
                  </strong>
                </div>
                {retirada.patronalCentavos > 0 && (
                  <div className="indicador">
                    <span className="indicador-rotulo">Patronal (Anexo IV)</span>
                    <strong className="indicador-valor num tom-negativo">
                      {formatarCentavos(retirada.patronalCentavos)}
                    </strong>
                    <span className="indicador-detalhe">20%, só neste anexo</span>
                  </div>
                )}
              </div>

              {retirada.avisos.includes('isento-pelo-redutor') && (
                <p className="sucesso-texto">
                  Sem IRRF a reter: a Lei 15.270/2025 zera o imposto até R$ 5.000 por mês, e reduz
                  parcialmente até R$ 7.350.
                </p>
              )}
              {retirada.avisos.includes('abaixo-do-minimo') && (
                <p className="erro-texto">
                  A retirada está abaixo do salário mínimo, mas o INSS incide sobre o mínimo mesmo
                  assim — retirar menos não reduz a contribuição.
                </p>
              )}
              {retirada.avisos.includes('no-teto-do-inss') && (
                <p className="nota">
                  A contribuição travou no teto do INSS: retirar mais não aumenta o INSS.
                </p>
              )}

              {sujeitoAoFatorR && rbt12Final > 0 && (
                <div className="acoes">
                  <p className="nota">
                    Doze meses desta retirada dão {formatarCentavos(fiscal.proLaboreCentavos * 12)}{' '}
                    de folha, ou {formatarPercentual((fiscal.proLaboreCentavos * 12 * 100) / rbt12Final)}{' '}
                    do seu RBT12.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      salvarFiscal({ folha12Centavos: fiscal.proLaboreCentavos * 12 });
                    }}
                  >
                    Usar como folha de 12 meses
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

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
