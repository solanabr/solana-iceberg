import type { ComponentType, SVGProps } from "react";
import solanaLogo from "@/assets/solanaWordMark.svg";
import { Github, Globe, Instagram, Linkedin } from "lucide-react";
import { useTranslation } from "@/i18n/context";

/* lucide 0.462 has no brand marks for X or Discord — its `X` is the close
   glyph — so those two are inline. Both use currentColor and the same 24-unit
   viewBox as the lucide icons so they sit at a matching optical weight. */
const XMark = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.833L7.084 4.126H5.117Z" />
  </svg>
);

const DiscordMark = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.28 18.28 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.35-1.22.645-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
  </svg>
);

/** Superteam Brasil's canonical handles, matching links.superteam.com.br. */
const SOCIALS: {
  name: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { name: "X", href: "https://x.com/SuperteamBR", Icon: XMark },
  {
    name: "Instagram",
    href: "https://www.instagram.com/superteam.brasil/",
    Icon: Instagram,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/superteambrasil/",
    Icon: Linkedin,
  },
  {
    name: "Discord",
    href: "https://discord.gg/superteambrasil",
    Icon: DiscordMark,
  },
  { name: "GitHub", href: "https://github.com/solanabr", Icon: Github },
  { name: "superteam.com.br", href: "https://superteam.com.br", Icon: Globe },
];

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer
      className="relative w-full py-12 px-6 border-t border-border/20"
      style={{
        background: "linear-gradient(180deg, #020408 0%, #0D0D1A 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={solanaLogo} alt="Solana" className="h-6 w-auto opacity-70" />
          <span className="text-foreground/40 text-sm">Iceberg</span>
        </div>

        {/* Socials — icon-only, so each carries its own accessible name. */}
        <nav aria-label="Superteam Brasil" className="flex items-center gap-5">
          {SOCIALS.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Superteam Brasil — ${name}`}
              /* p-1/-m-1 lifts the hit area to 28px without changing layout —
                 a bare 20px icon is under the WCAG 2.5.8 24x24 minimum. */
              className="text-foreground/40 hover:text-secondary transition-colors rounded p-1 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
            </a>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-foreground/30 text-xs">
          {t("footer.copyright", { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
