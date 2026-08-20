/** Portuguese (Brazil) UI strings */
// Explicit .js extension so this module also resolves under the api/
// tsconfig's NodeNext resolution — /api/meta imports these dictionaries for
// localized category names. Vite and tsc both rewrite .js -> .ts here.
import type { TranslationKey } from "./en.js";

const ptBR: Record<TranslationKey, string> = {
  // Index page
  "index.subtitle": "Glossário Interativo",

  // Search bar
  "search.placeholder": "Buscar {count} termos...",
  "search.random": "Termo aleatório",
  "layer.loaded": "Mostrando {shown} de {total} termos",
  "search.truncated":
    "Mostrando {shown} de {total} resultados — continue digitando para refinar",

  // Nav dropdown
  "nav.depth": "Camada",
  "nav.category": "Categoria",
  "nav.tag": "Tags",
  "nav.clearFilters": "Limpar filtros",
  "nav.clear": "Limpar",

  // Layer view
  "layer.filterPlaceholder": "Filtrar termos...",
  "layer.termCount": "{matched} de {total} termos",

  // Term view
  "term.aka": "também conhecido como",
  "term.depth.surface": "Superfície",
  "term.depth.shallow": "Raso",
  "term.depth.deep": "Profundo",
  "term.depth.abyss": "Abismo",
  "term.depth.bottom": "Fundo",
  "term.relatedSingular": "relacionado",
  "term.relatedPlural": "relacionados",

  // Iceberg SVG (on-iceberg term count labels)
  "iceberg.terms": "termos",
  "iceberg.termsFiltered": "termos",

  // Hamburger menu
  "hamburger.layers": "Camadas",

  // Footer
  "footer.copyright":
    "© {year} Superteam Brazil. Todos os direitos reservados.",
  "footer.builtBy": "Feito pela Superteam Brazil",

  // About section
  "about.pearlAria": "Saiba mais sobre o Solana Iceberg",
  "about.title": "Construído sobre",
  "about.brandShiny": "solana-glossary",
  "about.tagline":
    "O Solana Iceberg é um projeto divertido da Superteam Brazil para ajudar desenvolvedores a visualizar e explorar Solana, alimentado pelo SDK open-source solana-glossary — 1.059 termos em 14 categorias, 5 níveis de profundidade e i18n completo.",
  "about.step1.title": "O que é solana-glossary",
  "about.step1.body":
    "O glossário Solana mais completo já criado. 1.059 termos, 14 categorias, referências cruzadas via grafo de conhecimento, classificação de profundidade em 5 níveis e traduções em português e espanhol embutidas. Projetado para onboarding de devs, injeção de contexto em LLMs e educação do ecossistema.",
  "about.step2.title": "Instale o SDK",
  "about.step2.body":
    "Adicione o pacote npm a qualquer projeto JavaScript ou TypeScript.",
  "about.step3.title": "Instale o servidor MCP",
  "about.step3.body":
    "Cole este trecho na configuração MCP do Claude Desktop ou Claude Code para desbloquear 10 ferramentas: lookup_term, search_glossary, browse_category, filter_by_depth, filter_by_tag, get_related, inject_context, glossary_stats, list_categories, list_tags. Todas aceitam um parâmetro de locale opcional.",
  "about.step4.title": "Instale a skill de IA",
  "about.step4.body":
    "Ensina seu agente quando e como usar as ferramentas do glossário. Instale via skills-npm ou copie o SKILL.md para o diretório .claude/skills/ do seu projeto.",
  "about.step5.title": "Contribua com um termo novo",
  "about.step5.body":
    "Falta um termo? Abra um PR no repositório. Cada GlossaryTerm tem id, nome, definição, categoria, depth (1-5), além de arrays opcionais related, aliases e tags. Confira o CONTRIBUTING.md e envie contra main.",
  "about.step5.cta": "Abrir uma issue no GitHub",
  "about.footer":
    "Feito com ♥ pela Superteam Brazil · github.com/solanabr/solana-glossary",
  "about.copy": "Copiar",
  "about.copied": "Copiado",

  // Category labels
  "category.token-ecosystem": "Ecossistema de Tokens",
  "category.solana-ecosystem": "Ecossistema Solana",
  "category.web3": "Web3",
  "category.defi": "DeFi",
  "category.blockchain-general": "Blockchain Geral",
  "category.core-protocol": "Protocolo Central",
  "category.network": "Rede",
  "category.ai-ml": "IA & ML",
  "category.infrastructure": "Infraestrutura",
  "category.security": "Segurança",
  "category.zk-compression": "Compressão ZK",
  "category.programming-model": "Modelo de Programação",
  "category.programming-fundamentals": "Fundamentos de Programação",
  "category.dev-tools": "Ferramentas de Desenvolvimento",

  // Depth layer names (uppercase for iceberg display)
  "depth.surface": "SUPERFÍCIE",
  "depth.shallow": "SUPERFICIAL",
  "depth.deep": "PROFUNDO",
  "depth.abyss": "ABISMO",
  "depth.bottom": "FUNDO",
};

export default ptBR;
