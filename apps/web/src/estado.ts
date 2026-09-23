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
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AJUSTES_INICIAIS,
  apagarTudo,
  carregarAjustes,
  carregarLancamentos,
  gravarAjustes,
  gravarLancamentos,
  pedirPersistencia,
  removerLancamento,
} from './armazenamento.js';
import type { Ajustes } from './armazenamento.js';

export interface Bolso {
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly lancamentos: readonly Lancamento[];
  readonly ajustes: Ajustes;
  /** Regras proprias primeiro: o que a pessoa escreveu vence o que veio de fabrica. */
  readonly regras: readonly RegraCategorizacao[];
  importar: (novos: readonly Lancamento[]) => Promise<void>;
  atualizar: (lancamento: Lancamento) => Promise<void>;
  remover: (id: string) => Promise<void>;
  salvarAjustes: (ajustes: Ajustes) => Promise<void>;
  limparTudo: () => Promise<void>;
  substituirTudo: (lancamentos: readonly Lancamento[], ajustes: Ajustes) => Promise<void>;
}

export function useBolso(): Bolso {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<readonly Lancamento[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_INICIAIS);

  useEffect(() => {
    let vivo = true;

    void (async () => {
      try {
        const [guardados, ajustesGuardados] = await Promise.all([
          carregarLancamentos(),
          carregarAjustes(),
        ]);
        if (!vivo) return;
        setLancamentos(guardados);
        setAjustes(ajustesGuardados);
        void pedirPersistencia();
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
    importar,
    atualizar,
    remover,
    salvarAjustes,
    limparTudo,
    substituirTudo,
  };
}
