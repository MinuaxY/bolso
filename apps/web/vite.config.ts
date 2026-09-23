import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * A politica de seguranca de conteudo so entra no arquivo publicado.
 *
 * `connect-src 'none'` significa que o navegador bloqueia qualquer tentativa
 * de mandar dado para fora, mesmo que codigo malicioso ja esteja rodando na
 * pagina. E a garantia central do projeto, e ela e do navegador, nao uma
 * promessa nossa. Em desenvolvimento a regra nao se aplica porque o Vite
 * precisa de WebSocket para recarregar a pagina.
 */
const POLITICA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

function politicaDeSeguranca() {
  return {
    name: 'bolso-csp',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${POLITICA}" />`,
      );
    },
  };
}

export default defineConfig({
  // O app mora em minuaxy.github.io/bolso, entao os caminhos sao relativos a ele.
  base: '/bolso/',
  plugins: [react(), politicaDeSeguranca()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
