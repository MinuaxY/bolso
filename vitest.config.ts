import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // A cobertura continua medindo so o nucleo e os leitores. O app tem
      // teste onde ha logica que nao da para conferir olhando a tela — ler
      // backup, por exemplo —, mas exigir percentual de componente React
      // empurraria para teste de marcacao, que nao prova nada.
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      // O nucleo de dominio e a parte que nao pode quebrar: ele nao tem
      // interface para o usuario perceber o erro antes de o numero sair errado.
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
