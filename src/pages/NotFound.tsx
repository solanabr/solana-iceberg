import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/i18n/context";

/**
 * Reachable in production for the first time now that vercel.json serves
 * the SPA shell for any non-/api path. Only structurally invalid paths
 * land here — an unknown /t/:termId or /l/:layerId is redirected to the
 * locale home by useViewRoute, since a renamed term should not dead-end.
 */
const NotFound = () => {
  const { pathname } = useLocation();
  const { lang } = useTranslation();

  /* Keep the visitor in their language when sending them home. */
  const home = lang === "pt-BR" ? "/pt" : lang === "es" ? "/es" : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-[0.2em] text-secondary">
          404
        </h1>
        <p className="mt-4 text-lg text-foreground/80">
          This part of the iceberg doesn&apos;t exist.
        </p>
        <p className="mt-1 break-all font-mono text-sm text-muted-foreground/60">
          {pathname}
        </p>
        <Link
          to={home}
          className="mt-8 inline-block rounded-lg border border-secondary/20 bg-background/60 px-5 py-2.5 text-sm text-foreground/80 backdrop-blur-xl transition-colors hover:text-secondary"
          style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)" }}
        >
          Back to the surface
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
