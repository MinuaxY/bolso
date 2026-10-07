import { describe, expect, it } from 'vitest';

import { AJUSTES_INICIAIS } from './armazenamento.js';
import { lerBackup, serializarBackup } from './backup.js';
import type { Lancamento } from '@bolso/core';

const lancamento: Lancamento = {
  id: 'a1',
  tipo: 'despesa',
  data: '2026-09-10',
  competencia: '2026-09',
  valorCentavos: 4490,
  descricao: 'Netflix',
  categoria: 'Assinaturas',
  status: 'pago',
  formaPagamento: 'Credito',
};

describe('backup', () => {
  it('o que sai volta igual', () => {
    // A unica propriedade que importa de verdade neste arquivo. Ele e lido no
    // pior dia da pessoa, e ai nao da para descobrir que o formato mudou.
    const ajustes = { ...AJUSTES_INICIAIS, diaFechamento: 12, metas: [
      { categoria: 'Alimentacao', limiteCentavos: 80000 },
    ] };

    const lido = lerBackup(serializarBackup([lancamento], ajustes), AJUSTES_INICIAIS);

    expect(lido.lancamentos).toEqual([lancamento]);
    expect(lido.ajustes.diaFechamento).toBe(12);
    expect(lido.ajustes.metas).toEqual([{ categoria: 'Alimentacao', limiteCentavos: 80000 }]);
  });

  it('recusa arquivo que nao e backup do Bolso, antes de apagar nada', () => {
    expect(() => lerBackup('{"formato":"outra-coisa"}', AJUSTES_INICIAIS)).toThrow(
      /não é um backup do Bolso/,
    );
    expect(() => lerBackup('{}', AJUSTES_INICIAIS)).toThrow(/não é um backup do Bolso/);
  });

  it('recusa JSON quebrado em vez de restaurar pela metade', () => {
    expect(() => lerBackup('{isso nao e json', AJUSTES_INICIAIS)).toThrow();
  });

  it('backup antigo, sem o bloco fiscal, ainda restaura', () => {
    // Quem gerou backup antes do modulo fiscal existir tem um arquivo sem
    // essa chave. Ele nao pode virar lixo so porque o app cresceu.
    const antigo = JSON.stringify({
      formato: 'bolso-backup',
      versao: 1,
      gerado: '2026-06-01T00:00:00.000Z',
      ajustes: { diaFechamento: 5, regrasProprias: [] },
      lancamentos: [lancamento],
    });

    const lido = lerBackup(antigo, AJUSTES_INICIAIS);

    expect(lido.lancamentos).toHaveLength(1);
    expect(lido.ajustes.fiscal).toEqual(AJUSTES_INICIAIS.fiscal);
    expect(lido.ajustes.metas).toEqual([]);
  });

  it('recusa regra invalida vinda no backup', () => {
    const comRegraRuim = JSON.stringify({
      formato: 'bolso-backup',
      versao: 1,
      gerado: '2026-10-01T00:00:00.000Z',
      ajustes: {
        ...AJUSTES_INICIAIS,
        regrasProprias: [{ palavraChave: '', aplicaEm: 'despesa', categoria: 'X' }],
      },
      lancamentos: [],
    });

    expect(() => lerBackup(comRegraRuim, AJUSTES_INICIAIS)).toThrow();
  });

  it('o arquivo gravado e JSON legivel, nao uma linha so', () => {
    // Backup que a pessoa nao consegue abrir no bloco de notas e caixa-preta.
    const texto = serializarBackup([lancamento], AJUSTES_INICIAIS);
    expect(texto.split('\n').length).toBeGreaterThan(10);
    expect(JSON.parse(texto).formato).toBe('bolso-backup');
  });
});
