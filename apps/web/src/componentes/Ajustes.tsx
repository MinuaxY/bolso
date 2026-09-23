import { REGRAS_PADRAO, validarRegras } from '@bolso/core';
import type { Lancamento } from '@bolso/core';
import { useRef, useState } from 'react';

import { baixar, lerTextoDoArquivo } from '../arquivo.js';
import type { Ajustes as AjustesGuardados } from '../armazenamento.js';
import { plural } from '../formato.js';

interface Backup {
  readonly formato: 'bolso-backup';
  readonly versao: 1;
  readonly gerado: string;
  readonly ajustes: AjustesGuardados;
  readonly lancamentos: readonly Lancamento[];
}

export function Ajustes({
  ajustes,
  lancamentos,
  aoSalvar,
  aoLimpar,
  aoRestaurar,
}: {
  ajustes: AjustesGuardados;
  lancamentos: readonly Lancamento[];
  aoSalvar: (ajustes: AjustesGuardados) => Promise<void>;
  aoLimpar: () => Promise<void>;
  aoRestaurar: (lancamentos: readonly Lancamento[], ajustes: AjustesGuardados) => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  function exportar(): void {
    const backup: Backup = {
      formato: 'bolso-backup',
      versao: 1,
      gerado: new Date().toISOString(),
      ajustes,
      lancamentos,
    };
    const hoje = new Date().toISOString().slice(0, 10);
    baixar(`bolso-backup-${hoje}.json`, JSON.stringify(backup, null, 2));
    setMensagem('Backup salvo. Guarde-o como guardaria o extrato em PDF.');
  }

  async function restaurar(arquivo: File | undefined): Promise<void> {
    if (arquivo === undefined) return;
    setErro(null);
    setMensagem(null);

    try {
      const conteudo = JSON.parse(await lerTextoDoArquivo(arquivo)) as Partial<Backup>;

      if (conteudo.formato !== 'bolso-backup' || !Array.isArray(conteudo.lancamentos)) {
        throw new Error('Este arquivo não é um backup do Bolso.');
      }

      const ajustesDoBackup = conteudo.ajustes ?? ajustes;
      validarRegras(ajustesDoBackup.regrasProprias ?? []);

      await aoRestaurar(conteudo.lancamentos, {
        diaFechamento: ajustesDoBackup.diaFechamento,
        regrasProprias: ajustesDoBackup.regrasProprias,
      });
      setMensagem(
        `Backup restaurado: ${plural(conteudo.lancamentos.length, 'lançamento', 'lançamentos')}.`,
      );
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : String(causa));
    } finally {
      if (entrada.current !== null) entrada.current.value = '';
    }
  }

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Cartão de crédito</h2>
        <label className="campo">
          Dia em que a fatura fecha
          <input
            type="number"
            min={1}
            max={31}
            value={ajustes.diaFechamento}
            onChange={(evento) => {
              const dia = Number(evento.target.value);
              if (Number.isInteger(dia) && dia >= 1 && dia <= 31) {
                void aoSalvar({ ...ajustes, diaFechamento: dia });
              }
            }}
          />
          <small>
            Compra feita depois desse dia entra na fatura do mês seguinte. Vale para as próximas
            importações — o que já foi importado mantém o mês que recebeu.
          </small>
        </label>
      </section>

      <section className="cartao">
        <h2>Regras de categorização</h2>
        <p>
          {plural(REGRAS_PADRAO.length, 'regra de fábrica', 'regras de fábrica')} e{' '}
          {plural(ajustes.regrasProprias.length, 'regra sua', 'regras suas')}. As suas são
          consultadas primeiro.
        </p>
        {ajustes.regrasProprias.length > 0 && (
          <ul className="regras">
            {ajustes.regrasProprias.map((regra, indice) => (
              <li key={`${regra.palavraChave}-${String(indice)}`}>
                <code>{regra.palavraChave}</code> → {regra.categoria}
                <button
                  type="button"
                  className="apagar"
                  title="Remover esta regra"
                  onClick={() => {
                    void aoSalvar({
                      ...ajustes,
                      regrasProprias: ajustes.regrasProprias.filter((_, i) => i !== indice),
                    });
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao">
        <h2>Seus dados</h2>
        <p>
          Tudo o que você importou está gravado apenas neste navegador, nesta máquina. Não existe
          servidor, não existe conta e nada é enviado para lugar nenhum.
        </p>
        <p className="nota">
          Isso tem um preço: limpar os dados do navegador apaga o Bolso junto. Faça backup.
        </p>

        <div className="acoes">
          <button type="button" className="principal" onClick={exportar}>
            Baixar backup
          </button>

          <label className="botao-arquivo">
            Restaurar backup
            <input
              ref={entrada}
              type="file"
              accept="application/json,.json"
              onChange={(evento) => {
                void restaurar(evento.target.files?.[0]);
              }}
            />
          </label>
        </div>

        {mensagem !== null && <p className="sucesso-texto">{mensagem}</p>}
        {erro !== null && <p className="erro-texto">{erro}</p>}
      </section>

      <section className="cartao alerta">
        <h2>Apagar tudo</h2>
        <p>
          Remove todos os lançamentos e ajustes deste navegador. Não tem desfazer e não tem cópia
          em lugar nenhum — se você não baixou o backup, acabou.
        </p>
        {confirmando ? (
          <div className="acoes">
            <button
              type="button"
              className="perigo"
              onClick={() => {
                void aoLimpar();
                setConfirmando(false);
                setMensagem('Tudo apagado.');
              }}
            >
              Apagar mesmo assim
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="perigo"
            onClick={() => {
              setConfirmando(true);
            }}
          >
            Apagar meus dados
          </button>
        )}
      </section>
    </div>
  );
}
