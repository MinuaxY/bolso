/**
 * O estado do app.
 *
 * Tudo vive em memoria durante a sessao e e gravado no IndexedDB a cada
 * mudanca. Extrato pessoal cabe folgado na memoria — alguns milhares de
 * linhas por ano — e ler tudo de uma vez evita consulta assincrona no meio de
 * cada tela.
 */

import { REGRAS_PADRAO } from '@bolso/core';
import type { Lancamento, RegraCategorizacao } from '@bolso/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AJUSTES_INICIAIS,
  apagarTudo,
  carregarAjustes,
  carregarArquivoEspelho,
  carregarLancamentos,
  carregarUltimoBackup,
  esquecerArquivoEspelho,
  gravarAjustes,
  gravarArquivoEspelho,
  gravarLancamentos,
  gravarUltimoBackup,
  pedirPersistencia,
  removerLancamento,
} from './armazenamento.js';
import type { Ajustes } from './armazenamento.js';
import { serializarBackup } from './backup.js';
import {
  autorizarEspelho,
  explicarFalha,
  gravarNoEspelho,
  permissaoDoEspelho,
} from './espelho.js';
import type { ArquivoEspelho, Permissao } from './espelho.js';

/** Em que pe esta a copia automatica em arquivo. Ver `espelho.ts`. */
export interface EstadoEspelho {
  /** Ausente quando a pessoa nunca ligou o espelho. */
  readonly ligado: boolean;
  readonly permissao: Permissao;
  /** Quando o espelho gravou pela ultima vez, nesta sessao. */
  readonly gravadoEm: string | null;
  readonly erro: string | null;
}

export interface Bolso {
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly lancamentos: readonly Lancamento[];
  readonly ajustes: Ajustes;
  /** Regras proprias primeiro: o que a pessoa escreveu vence o que veio de fabrica. */
  readonly regras: readonly RegraCategorizacao[];
  readonly espelho: EstadoEspelho;
  /** Quando a pessoa baixou o ultimo backup manual. `null` se nunca baixou. */
  readonly ultimoBackup: string | null;
  importar: (novos: readonly Lancamento[]) => Promise<void>;
  atualizar: (lancamento: Lancamento) => Promise<void>;
  remover: (id: string) => Promise<void>;
  salvarAjustes: (ajustes: Ajustes) => Promise<void>;
  limparTudo: () => Promise<void>;
  substituirTudo: (lancamentos: readonly Lancamento[], ajustes: Ajustes) => Promise<void>;
  ligarEspelho: (arquivo: ArquivoEspelho) => Promise<void>;
  desligarEspelho: () => Promise<void>;
  autorizarGravacao: () => Promise<void>;
  registrarBackupManual: () => Promise<void>;
}

/**
 * Quanto esperar depois da ultima alteracao antes de reescrever o arquivo.
 *
 * Importar um extrato dispara uma mudanca de estado so, mas editar categoria
 * de varios lancamentos seguidos dispara uma por clique. Esperar um segundo
 * transforma uma rajada de edicoes numa gravacao.
 */
const ESPERA_MS = 1000;

export function useBolso(): Bolso {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<readonly Lancamento[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_INICIAIS);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  const [arquivoEspelho, setArquivoEspelho] = useState<ArquivoEspelho | null>(null);
  const [permissao, setPermissao] = useState<Permissao>('precisa-autorizar');
  const [gravadoEm, setGravadoEm] = useState<string | null>(null);
  const [erroEspelho, setErroEspelho] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    void (async () => {
      try {
        const [guardados, ajustesGuardados, arquivo, backup] = await Promise.all([
          carregarLancamentos(),
          carregarAjustes(),
          carregarArquivoEspelho(),
          carregarUltimoBackup(),
        ]);
        if (!vivo) return;
        setLancamentos(guardados);
        setAjustes(ajustesGuardados);
        setUltimoBackup(backup);
        void pedirPersistencia();

        if (arquivo !== null) {
          const retomado = arquivo as ArquivoEspelho;
          setArquivoEspelho(retomado);
          setPermissao(await permissaoDoEspelho(retomado));
        }
      } catch (causa) {
        if (vivo) setErro(causa instanceof Error ? causa.message : String(causa));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const importar = useCallback(async (novos: readonly Lancamento[]) => {
    await gravarLancamentos(novos);
    setLancamentos((atuais) => [...atuais, ...novos]);
  }, []);

  const atualizar = useCallback(async (lancamento: Lancamento) => {
    await gravarLancamentos([lancamento]);
    setLancamentos((atuais) => atuais.map((l) => (l.id === lancamento.id ? lancamento : l)));
  }, []);

  const remover = useCallback(async (id: string) => {
    await removerLancamento(id);
    setLancamentos((atuais) => atuais.filter((l) => l.id !== id));
  }, []);

  const salvarAjustes = useCallback(async (novos: Ajustes) => {
    await gravarAjustes(novos);
    setAjustes(novos);
  }, []);

  const limparTudo = useCallback(async () => {
    // O espelho sai ANTES de apagar, e nao depois: entre apagar e esquecer o
    // arquivo existe uma janela em que o efeito de gravacao poderia rodar com
    // a lista ja vazia e o arquivo ainda ligado. Ver `apagarTudo`.
    setArquivoEspelho(null);
    setPermissao('precisa-autorizar');
    setGravadoEm(null);
    await apagarTudo();
    setLancamentos([]);
    setAjustes(AJUSTES_INICIAIS);
  }, []);

  const substituirTudo = useCallback(
    async (novos: readonly Lancamento[], novosAjustes: Ajustes) => {
      await apagarTudo();
      await gravarLancamentos(novos);
      await gravarAjustes(novosAjustes);
      setLancamentos(novos);
      setAjustes(novosAjustes);
    },
    [],
  );

  const ligarEspelho = useCallback(
    async (arquivo: ArquivoEspelho) => {
      setErroEspelho(null);
      await gravarArquivoEspelho(arquivo);
      setArquivoEspelho(arquivo);
      setPermissao('concedida');
      // Grava na hora, sem esperar a proxima alteracao: a pessoa acabou de
      // escolher o arquivo e precisa ver que ele tem conteudo.
      await gravarNoEspelho(arquivo, serializarBackup(lancamentos, ajustes));
      setGravadoEm(new Date().toISOString());
    },
    [lancamentos, ajustes],
  );

  const desligarEspelho = useCallback(async () => {
    await esquecerArquivoEspelho();
    setArquivoEspelho(null);
    setGravadoEm(null);
    setErroEspelho(null);
  }, []);

  const autorizarGravacao = useCallback(async () => {
    if (arquivoEspelho === null) return;
    setPermissao(await autorizarEspelho(arquivoEspelho));
  }, [arquivoEspelho]);

  const registrarBackupManual = useCallback(async () => {
    const agora = new Date().toISOString();
    await gravarUltimoBackup(agora);
    setUltimoBackup(agora);
  }, []);

  /**
   * O espelho acompanhando o estado.
   *
   * Fica num efeito sobre o estado inteiro, e nao dentro de cada operacao, de
   * proposito: assim nenhum caminho novo de alteracao pode esquecer de
   * espelhar. Quem mexer em `importar`, `atualizar` ou `remover` amanha nao
   * precisa lembrar deste arquivo.
   */
  const ultimoGravado = useRef<string | null>(null);
  useEffect(() => {
    if (carregando || arquivoEspelho === null || permissao !== 'concedida') return;

    // NUNCA gravar backup vazio por conta propria. Sem esta linha, qualquer
    // caminho que zere a lista — limpar tudo, restauracao que falha no meio,
    // um erro de leitura na abertura — apagaria o arquivo que existe
    // justamente para esses dias. Backup vazio so por acao explicita.
    if (lancamentos.length === 0) return;

    const conteudo = serializarBackup(lancamentos, ajustes);
    // `gerado` muda a cada chamada, entao a comparacao ignora o cabecalho e
    // olha so o que interessa: se o dado nao mudou, nao reescreve o arquivo.
    const assinatura = JSON.stringify({ lancamentos, ajustes });
    if (assinatura === ultimoGravado.current) return;

    const relogio = setTimeout(() => {
      void (async () => {
        try {
          await gravarNoEspelho(arquivoEspelho, conteudo);
          ultimoGravado.current = assinatura;
          setGravadoEm(new Date().toISOString());
          setErroEspelho(null);
        } catch (causa) {
          // Arquivo apagado, pendrive removido, pasta sincronizando. Falhar
          // calado aqui seria pior do que nao ter espelho nenhum: a pessoa
          // acharia que esta protegida.
          setErroEspelho(explicarFalha(causa));
          setPermissao(await permissaoDoEspelho(arquivoEspelho));
        }
      })();
    }, ESPERA_MS);

    return () => {
      clearTimeout(relogio);
    };
  }, [carregando, lancamentos, ajustes, arquivoEspelho, permissao]);

  const espelho = useMemo<EstadoEspelho>(
    () => ({
      ligado: arquivoEspelho !== null,
      permissao,
      gravadoEm,
      erro: erroEspelho,
    }),
    [arquivoEspelho, permissao, gravadoEm, erroEspelho],
  );

  const regras = useMemo(
    () => [...ajustes.regrasProprias, ...REGRAS_PADRAO],
    [ajustes.regrasProprias],
  );

  return {
    carregando,
    erro,
    lancamentos,
    ajustes,
    regras,
    espelho,
    ultimoBackup,
    importar,
    atualizar,
    remover,
    salvarAjustes,
    limparTudo,
    substituirTudo,
    ligarEspelho,
    desligarEspelho,
    autorizarGravacao,
    registrarBackupManual,
  };
}
