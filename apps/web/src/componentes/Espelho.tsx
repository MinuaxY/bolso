import { useState } from 'react';

import { escolherEspelho, espelhoSuportado, explicarFalha } from '../espelho.js';
import type { ArquivoEspelho } from '../espelho.js';
import type { EstadoEspelho } from '../estado.js';

/** `2026-10-07T23:40:00Z` vira `hoje às 20:40`, que e o que a pessoa quer saber. */
function quando(iso: string): string {
  const momento = new Date(iso);
  const hora = momento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date().toDateString() === momento.toDateString();
  if (hoje) return `hoje às ${hora}`;
  return `${momento.toLocaleDateString('pt-BR')} às ${hora}`;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * A cobranca de backup para quem nao liga o espelho.
 *
 * Aparece so quando ha dado a perder e o ultimo backup esta velho. Sem o
 * espelho, a unica defesa e a memoria da pessoa — e lembrar de backup e
 * exatamente o que ninguem faz.
 */
export function AvisoDeBackup({
  ultimoBackup,
  temDados,
  espelhoLigado,
}: {
  ultimoBackup: string | null;
  temDados: boolean;
  espelhoLigado: boolean;
}) {
  if (!temDados || espelhoLigado) return null;

  const dias = ultimoBackup === null ? null : diasDesde(ultimoBackup);
  if (dias !== null && dias < 30) return null;

  return (
    <p className="erro-texto">
      {dias === null
        ? 'Você ainda não baixou nenhum backup. Se limpar os dados deste navegador agora, acabou.'
        : `Seu último backup é de ${String(dias)} dias atrás.`}
    </p>
  );
}

/**
 * Liga e desliga a copia automatica em arquivo.
 *
 * O texto aqui carrega mais peso do que o normal porque a pessoa esta
 * decidindo onde o historico financeiro dela vai viver, e precisa entender
 * duas coisas que nao sao obvias: que o arquivo e dela e nao nosso, e que
 * continuar sem servidor significa que a sincronizacao e a nuvem dela que
 * faz, escolhendo uma pasta sincronizada.
 */
export function Espelho({
  espelho,
  aoLigar,
  aoDesligar,
  aoAutorizar,
}: {
  espelho: EstadoEspelho;
  aoLigar: (arquivo: ArquivoEspelho) => Promise<void>;
  aoDesligar: () => Promise<void>;
  aoAutorizar: () => Promise<void>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function escolher(): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      const arquivo = await escolherEspelho();
      if (arquivo === null) return; // desistiu, nao e erro
      await aoLigar(arquivo);
    } catch (causa) {
      setErro(explicarFalha(causa));
    } finally {
      setOcupado(false);
    }
  }

  if (!espelhoSuportado()) {
    return (
      <section className="cartao">
        <h3>Cópia automática em arquivo</h3>
        <p className="nota">
          Seu navegador não oferece a permissão de escrever em arquivo que isto precisa — hoje só
          o Chrome e o Edge no computador têm. Continue usando o botão “Baixar backup” acima, e
          guarde o arquivo numa pasta que sincroniza.
        </p>
      </section>
    );
  }

  return (
    <section className={espelho.ligado ? 'cartao destaque' : 'cartao'}>
      <h3>Cópia automática em arquivo</h3>
      <p>
        Escolha um arquivo uma vez e o Bolso reescreve ele a cada alteração. Se você apontar para
        uma pasta que sincroniza — OneDrive, Google Drive, Dropbox —, seus dados passam a existir
        fora desta máquina, com o histórico de versões que esse serviço já guarda.
      </p>
      <p className="nota">
        Continua sem servidor: gravar em arquivo não é requisição de rede, e quem sincroniza a
        pasta é o seu serviço de nuvem, não o Bolso. A política de segurança do app segue com{' '}
        <code>connect-src &apos;none&apos;</code>.
      </p>

      {espelho.ligado ? (
        <>
          <div className="acoes">
            <button type="button" onClick={() => void escolher()} disabled={ocupado}>
              Trocar de arquivo
            </button>
            <button type="button" onClick={() => void aoDesligar()}>
              Desligar
            </button>
          </div>

          {espelho.permissao === 'concedida' ? (
            <p className="sucesso-texto">
              {espelho.gravadoEm === null
                ? 'Ligada. A próxima alteração já grava no arquivo.'
                : `Ligada. Última gravação ${quando(espelho.gravadoEm)}.`}
            </p>
          ) : (
            <>
              <p className="erro-texto">
                {espelho.permissao === 'negada'
                  ? 'O navegador negou a permissão de escrever nesse arquivo. Escolha o arquivo de novo.'
                  : 'O navegador reiniciou e precisa da sua autorização de novo para gravar. Enquanto você não autorizar, nada está sendo copiado.'}
              </p>
              {espelho.permissao === 'precisa-autorizar' && (
                <div className="acoes">
                  <button type="button" className="principal" onClick={() => void aoAutorizar()}>
                    Autorizar gravação
                  </button>
                </div>
              )}
            </>
          )}

          {espelho.erro !== null && (
            <p className="erro-texto">{espelho.erro}</p>
          )}
        </>
      ) : (
        <div className="acoes">
          <button
            type="button"
            className="principal"
            onClick={() => void escolher()}
            disabled={ocupado}
          >
            Escolher arquivo de backup
          </button>
        </div>
      )}

      {erro !== null && <p className="erro-texto">{erro}</p>}
    </section>
  );
}
