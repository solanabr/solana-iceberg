/**
 * AboutSection — an expandable footer panel explaining what
 * Solana Iceberg is and how to integrate the underlying
 * `@stbr/solana-glossary` SDK / MCP / skill.
 *
 * Content is driven by the `about.*` i18n keys so it translates
 * alongside the rest of the UI. The 6 steps below cover the same
 * touch points as the public README:
 *   1. What it is
 *   2. Install the SDK
 *   3. Install the MCP server
 *   4. Install the AI skill
 *   5. Use alongside an agent
 *   6. Contribute a new term
 *
 * Visuals are intentionally restrained: three slow-drifting
 * blurred fluid blobs in Solana purple + teal behind a vertical
 * stack of glass cards, with copy buttons on every code block.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Github } from "lucide-react";
import ShinyText from "@/components/reactbits/ShinyText";
import { useTranslation } from "@/i18n/context";
import { depthPillColors } from "@/data/glossaryAdapter";

/* ── Exact content from the upstream README ──
   These strings are intentionally NOT in i18n: installation
   commands and JSON config must match the public package
   verbatim regardless of the user's language. */
const INSTALL_SDK_CMDS = ["npm i @stbr/solana-glossary"];

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "solana-glossary": {
      "command": "npx",
      "args": ["@stbr/solana-glossary"]
    }
  }
}`;

const SKILL_CMD = "npm skill add @stbr/solana-glossary";

const GITHUB_ISSUES_URL = "https://github.com/solanabr/solana-glossary/issues";
const GITHUB_REPO_URL = "https://github.com/solanabr/solana-glossary";

/* ── Copyable code block ── */
const CodeBlock = ({
  code,
  language = "shell",
}: {
  code: string;
  language?: "shell" | "json" | "ts";
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    /* Try the modern Clipboard API first; on denial or absence,
       fall back to the legacy execCommand('copy') path via a
       temporary textarea so the feature still works in restricted
       iframes / preview environments. */
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        /* Both paths blocked — still show the visual feedback so
           the user knows the click was registered. In a real
           browser at least one path will succeed. */
      }
    }
    /* Always flash the "copied" state so the user gets visual
       confirmation the button was clicked. */
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative group">
      <pre
        className="font-mono text-[13px] leading-relaxed bg-black/40 border border-white/10 rounded-xl p-4 pr-12 overflow-x-auto text-foreground/85"
        style={{
          /* Subtle inner highlight to read as glassy depth */
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t("about.copy")}
        title={copied ? t("about.copied") : t("about.copy")}
        className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-secondary/40 text-foreground/70 hover:text-secondary transition-all"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-secondary" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
};

/* ── Single step card ──
   The `index` prop drives the left-edge color accent: each card
   maps to one of the 5 iceberg depth layers (surface → bottom),
   so the color progression mirrors the depth-pill palette used
   elsewhere on the site. No numeric badge is rendered — the
   color itself carries the "where am I in the flow" signal. */
const StepCard = ({
  index,
  title,
  body,
  children,
}: {
  index: number; // 1..5
  title: string;
  body: string;
  children?: React.ReactNode;
}) => {
  const palette: string[] = [
    depthPillColors.surface,
    depthPillColors.shallow,
    depthPillColors.deep,
    depthPillColors.abyss,
    depthPillColors.bottom,
  ];
  const color = palette[index - 1] ?? depthPillColors.surface;
  return (
    <div
      className="relative rounded-2xl border bg-white/[0.03] backdrop-blur-md p-5 md:p-6 transition-colors overflow-hidden"
      style={{
        borderColor: `${color}40`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px ${color}14`,
      }}
    >
      {/* Left-edge color bar — replaces the numbered badge. Pure
          visual cue tied to the iceberg depth palette. */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        aria-hidden="true"
        style={{
          background: `linear-gradient(180deg, ${color} 0%, ${color}66 100%)`,
          boxShadow: `0 0 12px ${color}80`,
        }}
      />
      <div className="pl-3 md:pl-4">
        <h3
          className="text-lg md:text-xl font-semibold mb-1.5"
          style={{ color }}
        >
          {title}
        </h3>
        <p className="text-sm md:text-[15px] text-foreground/70 leading-relaxed">
          {body}
        </p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
};

/* ── Fluid blob background — 3 blurred orbs drifting slowly ── */
const FluidBlobs = ({ disabled }: { disabled: boolean }) => {
  const blobs = [
    {
      color: "#9945FF",
      initial: { top: "10%", left: "10%" },
      size: 420,
      /* Slow wander keyframes — intentionally small deltas so the
         movement reads as viscous drift, not a dance. */
      animate: disabled
        ? undefined
        : { x: [0, 80, -40, 0], y: [0, -60, 30, 0], scale: [1, 1.1, 0.95, 1] },
      transition: disabled
        ? undefined
        : { duration: 22, ease: "easeInOut", repeat: Infinity },
      opacity: 0.22,
    },
    {
      color: "#14F195",
      initial: { top: "45%", right: "5%" },
      size: 360,
      animate: disabled
        ? undefined
        : { x: [0, -70, 40, 0], y: [0, 50, -20, 0], scale: [1, 0.92, 1.08, 1] },
      transition: disabled
        ? undefined
        : { duration: 18, ease: "easeInOut", repeat: Infinity },
      opacity: 0.16,
    },
    {
      color: "#9945FF",
      initial: { bottom: "5%", left: "30%" },
      size: 380,
      animate: disabled
        ? undefined
        : { x: [0, 50, -60, 0], y: [0, -30, 20, 0], scale: [1, 1.05, 0.97, 1] },
      transition: disabled
        ? undefined
        : { duration: 26, ease: "easeInOut", repeat: Infinity },
      opacity: 0.14,
    },
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            ...blob.initial,
            width: blob.size,
            height: blob.size,
            background: `radial-gradient(circle, ${blob.color} 0%, ${blob.color}00 70%)`,
            filter: "blur(60px)",
            opacity: blob.opacity,
          }}
          animate={blob.animate}
          transition={blob.transition}
        />
      ))}
    </div>
  );
};

const AboutSection = () => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.3, ease: "easeOut" },
      }}
      className="relative w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0D0D1A 0%, #020408 100%)",
      }}
    >
      <FluidBlobs disabled={!!prefersReducedMotion} />

      <div className="relative max-w-3xl mx-auto px-6 pt-6 md:pt-8 pb-16 md:pb-24 z-10">
        {/* Header — "Built on" sits on the first line in muted white,
            then "solana-glossary" flows on the second line with the
            brand ShinyText effect so the brand reads as the hero
            element. Tight top padding so the pearl sits close above. */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-4xl font-bold tracking-wide text-foreground/80">
            {t("about.title")}
          </h2>
          <div className="text-3xl md:text-5xl font-bold tracking-wide mt-2 mb-5">
            <ShinyText
              text={t("about.brandShiny")}
              speed={4}
              color="#14F195"
              shineColor="#ffffff"
            />
          </div>
          <p className="text-sm md:text-base text-foreground/65 leading-relaxed max-w-2xl mx-auto">
            {t("about.tagline")}
          </p>
        </div>

        {/* Steps — exactly 5 cards so the depth-palette accent colors
            map 1:1 onto the 5 iceberg layers (surface → shallow →
            deep → abyss → bottom). No numeric badges. */}
        <div className="flex flex-col gap-4 md:gap-5">
          <StepCard
            index={1}
            title={t("about.step1.title")}
            body={t("about.step1.body")}
          />

          <StepCard
            index={2}
            title={t("about.step2.title")}
            body={t("about.step2.body")}
          >
            <CodeBlock code={INSTALL_SDK_CMDS.join("\n")} language="shell" />
          </StepCard>

          <StepCard
            index={3}
            title={t("about.step3.title")}
            body={t("about.step3.body")}
          >
            <CodeBlock code={MCP_CONFIG_JSON} language="json" />
          </StepCard>

          <StepCard
            index={4}
            title={t("about.step4.title")}
            body={t("about.step4.body")}
          >
            <CodeBlock code={SKILL_CMD} language="shell" />
          </StepCard>

          <StepCard
            index={5}
            title={t("about.step5.title")}
            body={t("about.step5.body")}
          >
            <a
              href={GITHUB_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-secondary/50 text-sm font-medium text-foreground/85 hover:text-secondary transition-all"
            >
              <Github className="w-4 h-4" />
              {t("about.step5.cta")}
            </a>
          </StepCard>
        </div>

        {/* Footer line */}
        <div className="mt-12 text-center">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs md:text-sm text-foreground/45 hover:text-secondary transition-colors"
          >
            {t("about.footer")}
          </a>
        </div>
      </div>
    </motion.section>
  );
};

export default AboutSection;
