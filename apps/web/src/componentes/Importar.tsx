import { classificarImportacao } from '@bolso/core';
import type { Lancamento, RegraCategorizacao } from '@bolso/core';
import { lerArquivo } from '@bolso/parsers';
import type { Leitura } from '@bolso/parsers';
import { useMemo, useRef, useState } from 'react';

import { lerTextoDoArquivo } from '../arquivo.js';
import { converter, paraComparacao } from '../conversao.js';
import { dataCompleta, formatarCentavos, plural } from '../formato.js';

const NOME_DA_FONTE: Record<string, string> = {
  'nubank-credito': 'Nubank — fatura do cartão (CSV)',
  'nubank-debito': 'Nubank — extrato da conta (CSV)',
  'xp-fatura': 'XP — fatura do cartão (CSV)',
  'ofx-cartao': 'OFX — fatura de cartão',
  'ofx-conta': 'OFX — extrato de conta',
  generico: 'Arquivo genérico',
};

interface Previa {
  readonly nomeArquivo: string;
  readonly leitura: Leitura;
}

export function Importar({
  lancamentosExistentes,
  regras,
  diaFechamento,
  aoImportar,
}: {
  lancamentosExistentes: readonly Lancamento[];
  regras: readonly RegraCategorizacao[];
  diaFechamento: number;
  aoImportar: (novos: readonly Lancamento[]) => Promise<void>;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ehCartao, setEhCartao] = useState(true);
  const [conta, setConta] = useState('Conta principal');
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [concluido, setConcluido] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function receber(arquivo: File | undefined): Promise<void> {
    if (arquivo === undefined) return;
    setErro(null);
    setConcluido(null);

    try {
      const texto = await lerTextoDoArquivo(arquivo);
      const leitura = lerArquivo(texto);
      setEhCartao(leitura.ehCartao);
      setPrevia({ nomeArquivo: arquivo.name, leitura });
    } catch (causa) {
      setPrevia(null);
      setErro(causa instanceof Error ? causa.message : String(causa));
    }
  }

  const convertidos = useMemo(() => {
    if (previa === null) return [];
    return previa.leitura.lancamentos.map((importado) =>
      converter(importado, {
        fonte: previa.leitura.fonte,
        arquivo: previa.nomeArquivo,
        diaFechamento,
        regras,
        ehCartao,
        conta,
      }),
    );
  }, [previa, ehCartao, conta, diaFechamento, regras]);

  const classificacao = useMemo(
    () =>
      classificarImportacao(
        convertidos,
        lancamentosExistentes.map(paraComparacao),
        paraComparacao,
      ),
    [convertidos, lancamentosExistentes],
  );

  const novos = classificacao.novos;
  const emRevisao = novos.filter((l) => l.precisaRevisao === true).length;

  async function confirmar(): Promise<void> {
    await aoImportar(novos);
    setConcluido(
      `${plural(novos.length, 'lançamento importado', 'lançamentos importados')} de ${
        previa?.nomeArquivo ?? 'arquivo'
      }.`,
    );
    setPrevia(null);
    if (entrada.current !== null) entrada.current.value = '';
  }

  return (
    <div className="pilha">
      <section
        className={`solta ${arrastando ? 'solta-ativa' : ''}`}
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => {
          setArrastando(false);
        }}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastando(false);
          void receber(evento.dataTransfer.files[0]);
        }}
      >
        <h2>Importar extrato</h2>
        <p>
          Arraste aqui o arquivo que o seu banco exporta — CSV ou OFX —, ou escolha abaixo. O
          arquivo é lido no seu navegador e não sai desta máquina.
        </p>
        <input
          ref={entrada}
          type="file"
          accept=".csv,.ofx,.qfx,.txt,text/csv,text/plain,application/x-ofx"
          onChange={(evento) => {
            void receber(evento.target.files?.[0]);
          }}
        />
      </section>

      <details className="cartao ajuda">
        <summary>Não sei onde achar esse arquivo no meu banco</summary>

        <p>
          O caminho é parecido em todo banco: abra o <strong>extrato</strong>, escolha o período e
          procure <strong>exportar</strong>, <strong>salvar</strong> ou um ícone de compartilhar, em
          geral no topo da tela.
        </p>

        <p className="nota">
          Se o seu banco oferecer OFX e CSV, <strong>prefira OFX</strong>: ele traz um identificador
          por transação, então o Bolso sabe o que já foi importado sem precisar adivinhar.
        </p>

        <dl className="ficha">
          <div>
            <dt>Nubank — conta</dt>
            <dd>Toque no saldo → ícone de exportar → OFX ou CSV</dd>
          </div>
          <div>
            <dt>Nubank — cartão</dt>
            <dd>Abra a fatura → exportar fatura</dd>
          </div>
          <div>
            <dt>Itaú, Bradesco, BB, Caixa</dt>
            <dd>Internet banking → Extrato → período → Exportar → OFX</dd>
          </div>
          <div>
            <dt>Santander e Sicoob</dt>
            <dd>O OFX aparece com o nome antigo, “Money” — é o mesmo arquivo</dd>
          </div>
        </dl>

        <p className="nota">
          <strong>Exporte todo mês.</strong> A maioria dos bancos guarda só os últimos 60 a 90 dias.
          E não abra o arquivo no Excel antes de importar: ele reescreve separador e data ao salvar.
        </p>

        <p className="nota">
          Banco que não está nesta lista também funciona — se o Bolso não reconhecer as colunas, ele
          pergunta qual é qual. O guia completo está{' '}
          <a href="https://github.com/MinuaxY/bolso/blob/main/docs/exportar-extrato.md">
            no repositório
          </a>
          .
        </p>
      </details>

      {erro !== null && (
        <section className="cartao alerta">
          <h3>Não consegui ler este arquivo</h3>
          <p>{erro}</p>
        </section>
      )}

      {concluido !== null && (
        <section className="cartao sucesso">
          <p>{concluido}</p>
        </section>
      )}

      {previa !== null && (
        <>
          <section className="cartao">
            <h3>{previa.nomeArquivo}</h3>
            <dl className="ficha">
              <div>
                <dt>Reconheci como</dt>
                <dd>{NOME_DA_FONTE[previa.leitura.fonte] ?? previa.leitura.fonte}</dd>
              </div>
              <div>
                <dt>Formato do arquivo</dt>
                <dd>
                  {previa.leitura.dialeto.delimitador === 'OFX' ? (
                    <>OFX: data e valor em campo próprio, com identificador por transação</>
                  ) : (
                    <>
                      separador{' '}
                      <code>{previa.leitura.dialeto.delimitador === ';' ? ';' : ','}</code>, data{' '}
                      {previa.leitura.dialeto.formatoData === 'iso' ? 'AAAA-MM-DD' : 'DD/MM/AAAA'},
                      decimal com {previa.leitura.dialeto.decimalVirgula ? 'vírgula' : 'ponto'}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>Li</dt>
                <dd>{plural(previa.leitura.lancamentos.length, 'lançamento', 'lançamentos')}</dd>
              </div>
              <div>
                <dt>Já tinha</dt>
                <dd>
                  {classificacao.duplicados.length === 0
                    ? 'nenhum repetido'
                    : plural(classificacao.duplicados.length, 'repetido', 'repetidos')}
                </dd>
              </div>
            </dl>

            <div className="opcoes">
              <label>
                <input
                  type="checkbox"
                  checked={ehCartao}
                  onChange={(evento) => {
                    setEhCartao(evento.target.checked);
                  }}
                />
                É fatura de cartão de crédito
                <small>
                  Compra depois do dia {diaFechamento} entra na fatura do mês seguinte. Extrato de
                  conta segue o calendário.
                </small>
              </label>

              {!ehCartao && (
                <label>
                  Nome da conta
                  <input
                    type="text"
                    value={conta}
                    onChange={(evento) => {
                      setConta(evento.target.value);
                    }}
                  />
                </label>
              )}
            </div>

            <button type="button" className="principal" disabled={novos.length === 0} onClick={() => void confirmar()}>
              {novos.length === 0
                ? 'Nada de novo para importar'
                : `Importar ${plural(novos.length, 'lançamento', 'lançamentos')}`}
            </button>

            {emRevisao > 0 && (
              <p className="nota">
                {plural(emRevisao, 'lançamento vai', 'lançamentos vão')} para a fila de revisão:
                nenhuma regra reconheceu, ou a regra pediu conferência.
              </p>
            )}
          </section>

          {previa.leitura.erros.length > 0 && (
            <section className="cartao alerta">
              <h3>{plural(previa.leitura.erros.length, 'linha recusada', 'linhas recusadas')}</h3>
              <p>O resto do arquivo importa normalmente.</p>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Motivo</th>
                    <th>Conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.leitura.erros.slice(0, 10).map((erroLinha) => (
                    <tr key={erroLinha.linha}>
                      <td className="num">{erroLinha.linha}</td>
                      <td>{erroLinha.motivo}</td>
                      <td className="truncar">{erroLinha.conteudo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="cartao">
            <h3>Prévia</h3>
            <p className="nota">
              Como os lançamentos vão ficar depois das regras de categorização.
            </p>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Mês</th>
                    <th className="direita">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {novos.slice(0, 15).map((lancamento) => (
                    <tr key={lancamento.id} className={lancamento.precisaRevisao === true ? 'revisar' : ''}>
                      <td className="num">{dataCompleta(lancamento.data)}</td>
                      <td>
                        {lancamento.descricao}
                        {lancamento.tipo === 'despesa' && lancamento.parcela !== undefined && (
                          <span className="etiqueta">
                            {lancamento.parcela.atual}/{lancamento.parcela.total}
                          </span>
                        )}
                        {lancamento.natureza !== undefined && (
                          <span className="etiqueta etiqueta-suave">{lancamento.natureza}</span>
                        )}
                      </td>
                      <td>{lancamento.categoria}</td>
                      <td className="num">{lancamento.competencia}</td>
                      <td className={`num direita ${lancamento.tipo === 'receita' ? 'tom-positivo' : ''}`}>
                        {formatarCentavos(lancamento.valorCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {novos.length > 15 && (
              <p className="nota">e mais {String(novos.length - 15)} não mostrados aqui.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
