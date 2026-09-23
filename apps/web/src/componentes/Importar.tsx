import { classificarImportacao } from '@bolso/core';
import type { Lancamento, RegraCategorizacao } from '@bolso/core';
import { lerArquivo } from '@bolso/parsers';
import type { Leitura } from '@bolso/parsers';
import { useMemo, useRef, useState } from 'react';

import { lerTextoDoArquivo } from '../arquivo.js';
import { converter, paraComparacao } from '../conversao.js';
import { dataCompleta, formatarCentavos, plural } from '../formato.js';

const NOME_DA_FONTE: Record<string, string> = {
  'nubank-credito': 'Nubank — fatura do cartão',
  'nubank-debito': 'Nubank — extrato da conta',
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
      setEhCartao(leitura.fonte === 'nubank-credito');
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
          Arraste aqui o arquivo CSV que o seu banco exporta, ou escolha abaixo. O arquivo é lido
          no seu navegador e não sai desta máquina.
        </p>
        <input
          ref={entrada}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={(evento) => {
            void receber(evento.target.files?.[0]);
          }}
        />
      </section>

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
                  separador <code>{previa.leitura.dialeto.delimitador === ';' ? ';' : ','}</code>,
                  data {previa.leitura.dialeto.formatoData === 'iso' ? 'AAAA-MM-DD' : 'DD/MM/AAAA'},
                  decimal com {previa.leitura.dialeto.decimalVirgula ? 'vírgula' : 'ponto'}
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
