import { describe, expect, it } from 'vitest';

import { corrigirMojibake, normalizar } from './texto.js';

/**
 * Simula o defeito real: um texto em UTF-8 lido byte a byte como se fosse
 * CP1252. E exatamente o que acontece quando o extrato passa por uma
 * ferramenta que erra a codificacao.
 */
function quebrarCodificacao(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}

describe('normalizar', () => {
  it('tira acento, caixa e espaco sobrando', () => {
    expect(normalizar('  Farmácia   São João ')).toBe('farmacia sao joao');
  });

  it('trata cedilha e til, que sao o caso comum em nome de estabelecimento', () => {
    expect(normalizar('Ações e Transferência')).toBe('acoes e transferencia');
  });

  it('deixa passar o que ja esta normalizado', () => {
    expect(normalizar('99food')).toBe('99food');
  });

  it('nao engole numero nem simbolo, que fazem parte da descricao do banco', () => {
    expect(normalizar('99food *53.982.254 Ell')).toBe('99food *53.982.254 ell');
  });
});

describe('corrigirMojibake', () => {
  it('desfaz a leitura errada de codificacao', () => {
    const quebrado = quebrarCodificacao('Ação');
    expect(quebrado).not.toBe('Ação');
    expect(corrigirMojibake(quebrado)).toBe('Ação');
  });

  it('recupera uma descricao inteira de extrato', () => {
    const original = 'Transferência recebida - MERCADO SÃO JOÃO';
    expect(corrigirMojibake(quebrarCodificacao(original))).toBe(original);
  });

  it('nao mexe em texto que ja esta certo', () => {
    expect(corrigirMojibake('Ação')).toBe('Ação');
    expect(corrigirMojibake('99food *Jyk Food')).toBe('99food *Jyk Food');
  });

  it('devolve o original quando a reinterpretacao nao faz sentido', () => {
    // Emoji tem codigo acima de um byte: o texto nao veio da leitura errada.
    expect(corrigirMojibake('Almoço 🍔')).toBe('Almoço 🍔');
  });

  it('nao inventa correcao em texto puramente ASCII', () => {
    expect(corrigirMojibake('Amazon Marketplace Cc')).toBe('Amazon Marketplace Cc');
  });
});
