/** Spanish (ES) UI strings */
// Explicit .js extension so this module also resolves under the api/
// tsconfig's NodeNext resolution — /api/meta imports these dictionaries for
// localized category names. Vite and tsc both rewrite .js -> .ts here.
import type { TranslationKey } from "./en.js";

const es: Record<TranslationKey, string> = {
  // Index page
  "index.subtitle": "Glosario Interactivo",

  // Search bar
  "search.placeholder": "Buscar {count} términos...",
  "search.random": "Término aleatorio",
  "layer.loaded": "Mostrando {shown} de {total} términos",
  "search.truncated":
    "Mostrando {shown} de {total} resultados — sigue escribiendo para afinar",
  "search.noResults":
    'Ningún término coincide con "{query}" — prueba con otra palabra',

  // Nav dropdown
  "nav.back": "Volver",
  "nav.depth": "Capa",
  "nav.category": "Categoría",
  "nav.tag": "Tags",
  "nav.clearFilters": "Limpiar filtros",
  "nav.clear": "Limpiar",

  // Layer view
  "layer.filterPlaceholder": "Filtrar términos...",
  "layer.termCount": "{matched} de {total} términos",

  // Term view
  "term.aka": "también conocido como",
  "term.depth.surface": "Superficie",
  "term.depth.shallow": "Superficial",
  "term.depth.deep": "Profundo",
  "term.depth.abyss": "Abismo",
  "term.depth.bottom": "Fondo",
  "term.relatedSingular": "relacionado",
  "term.relatedPlural": "relacionados",

  // Iceberg SVG (on-iceberg term count labels)
  "iceberg.terms": "términos",
  "iceberg.termsFiltered": "términos",

  // Hamburger menu
  "hamburger.layers": "Capas",

  // Footer
  "footer.copyright":
    "© {year} Superteam Brazil. Todos los derechos reservados.",
  "footer.builtBy": "Hecho por Superteam Brazil",

  // About section
  "about.pearlAria": "Conoce más sobre Solana Iceberg",
  "about.title": "Construido sobre",
  "about.brandShiny": "solana-glossary",
  "about.tagline":
    "Solana Iceberg es un proyecto divertido de Superteam Brazil para ayudar a los desarrolladores a visualizar y explorar Solana, impulsado por el SDK open-source solana-glossary — 1.059 términos en 14 categorías, 5 niveles de profundidad e i18n completo.",
  "about.step1.title": "Qué es solana-glossary",
  "about.step1.body":
    "El glosario de Solana más completo jamás creado. 1.059 términos, 14 categorías, referencias cruzadas vía grafo de conocimiento, calificación de profundidad de 5 niveles y traducciones al portugués y español incluidas. Diseñado para onboarding de devs, inyección de contexto en LLMs y educación del ecosistema.",
  "about.step2.title": "Instala el SDK",
  "about.step2.body":
    "Agrega el paquete npm a cualquier proyecto JavaScript o TypeScript.",
  "about.step3.title": "Instala el servidor MCP",
  "about.step3.body":
    "Coloca este fragmento en tu configuración MCP de Claude Desktop o Claude Code para desbloquear 10 herramientas: lookup_term, search_glossary, browse_category, filter_by_depth, filter_by_tag, get_related, inject_context, glossary_stats, list_categories, list_tags. Todas aceptan un parámetro locale opcional.",
  "about.step4.title": "Instala la skill de IA",
  "about.step4.body":
    "Le indica a tu agente cuándo y cómo usar las herramientas del glosario. Instala vía skills-npm o copia el SKILL.md al directorio .claude/skills/ de tu proyecto.",
  "about.step5.title": "Contribuye un nuevo término",
  "about.step5.body":
    "¿Falta un término? Abre un PR en el repositorio. Cada GlossaryTerm tiene un id, nombre, definición, categoría, depth (1-5), más arrays opcionales related, aliases y tags. Consulta CONTRIBUTING.md y envíalo contra main.",
  "about.step5.cta": "Abrir un issue en GitHub",
  "about.footer":
    "Hecho con ♥ por Superteam Brazil · github.com/solanabr/solana-glossary",
  "about.copy": "Copiar",
  "about.copied": "Copiado",

  // Category labels
  "category.token-ecosystem": "Ecosistema de Tokens",
  "category.solana-ecosystem": "Ecosistema Solana",
  "category.web3": "Web3",
  "category.defi": "DeFi",
  "category.blockchain-general": "Blockchain General",
  "category.core-protocol": "Protocolo Central",
  "category.network": "Red",
  "category.ai-ml": "IA & ML",
  "category.infrastructure": "Infraestructura",
  "category.security": "Seguridad",
  "category.zk-compression": "Compresión ZK",
  "category.programming-model": "Modelo de Programación",
  "category.programming-fundamentals": "Fundamentos de Programación",
  "category.dev-tools": "Herramientas de Desarrollo",

  // Depth layer names (uppercase for iceberg display)
  "depth.surface": "SUPERFICIE",
  "depth.shallow": "SUPERFICIAL",
  "depth.deep": "PROFUNDO",
  "depth.abyss": "ABISMO",
  "depth.bottom": "FONDO",
};

export default es;
