import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/i18n/context";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <ErrorBoundary>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Every route here renders the same <Index /> — which view
              it shows is derived from the URL by useViewRoute. The
              locale segment is spelled out per language (rather than a
              `:lang` param) so an unknown prefix like /fr/t/slot falls
              through to NotFound instead of parsing as a locale.
              Mirrors the rewrites in vercel.json one-for-one. */}
          <Route path="/" element={<Index />} />
          <Route path="/t/:termId" element={<Index />} />
          <Route path="/l/:layerId" element={<Index />} />

          <Route path="/pt" element={<Index />} />
          <Route path="/pt/t/:termId" element={<Index />} />
          <Route path="/pt/l/:layerId" element={<Index />} />

          <Route path="/es" element={<Index />} />
          <Route path="/es/t/:termId" element={<Index />} />
          <Route path="/es/l/:layerId" element={<Index />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
