import solanaLogo from "@/assets/solanaWordMark.svg";
import { Github, Twitter, Globe } from "lucide-react";
import { useTranslation } from "@/i18n/context";

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
          <img
            src={solanaLogo}
            alt="Solana"
            className="h-6 w-auto opacity-70"
          />
          <span className="text-foreground/40 text-sm">Iceberg</span>
        </div>

        {/* Socials */}
        <div className="flex items-center gap-5">
          <a
            href="https://twitter.com/solana"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/40 hover:text-secondary transition-colors"
          >
            <Twitter className="w-5 h-5" />
          </a>
          <a
            href="https://github.com/solana-labs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/40 hover:text-secondary transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/40 hover:text-secondary transition-colors"
          >
            <Globe className="w-5 h-5" />
          </a>
        </div>

        {/* Copyright */}
        <p className="text-foreground/30 text-xs">
          {t("footer.copyright", { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
