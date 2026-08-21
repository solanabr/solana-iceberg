import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import {
  getIcebergLayers,
  categoryLabels,
  getAllTags,
  type Category,
} from "@/data/glossaryAdapter";
import { useTranslation } from "@/i18n/context";

const icebergLayers = getIcebergLayers();

const allCategories: { id: Category; name: string }[] = (
  Object.entries(categoryLabels) as [Category, string][]
).map(([id, name]) => ({ id, name }));

const allTags: { id: string; name: string }[] = getAllTags().map((tag) => ({
  id: tag,
  name: tag,
}));

interface Props {
  onLayerClick: (layerId: string) => void;
  onCategoryClick?: (category: string) => void;
  selectedCategories?: Set<Category>;
  onClearCategories?: () => void;
  onTagClick?: (tag: string) => void;
  selectedTags?: Set<string>;
  onClearTags?: () => void;
}

const DropdownSection = ({
  label,
  items,
  onSelect,
  multiSelect = false,
  selected,
  onClear,
  clearLabel,
}: {
  label: string;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  multiSelect?: boolean;
  selected?: Set<string>;
  onClear?: () => void;
  clearLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string) => {
    onSelect(id);
    if (!multiSelect) setOpen(false);
  };

  const activeCount = selected?.size ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 text-sm font-medium text-foreground/80 hover:text-secondary transition-colors"
        style={{ height: "36px" }}
      >
        {label}
        {multiSelect && activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-52 rounded-xl border border-secondary/20 bg-background/90 backdrop-blur-xl p-2 z-[70] max-h-80 overflow-y-auto"
          style={{ boxShadow: "0 0 30px rgba(20,241,149,0.1)" }}
        >
          {multiSelect && activeCount > 0 && onClear && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 mb-1 rounded-lg text-xs font-medium transition-all flex items-center gap-2 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border-b border-secondary/10 pb-2"
            >
              <X className="w-3 h-3" />
              {clearLabel}
            </button>
          )}
          {items.map((item) => {
            const isSelected = selected?.has(item.id) ?? false;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  isSelected
                    ? "text-secondary bg-secondary/10"
                    : "text-foreground/80 hover:text-secondary hover:bg-secondary/10"
                }`}
              >
                {multiSelect && (
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "border-secondary bg-secondary/20"
                        : "border-foreground/20"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-secondary" />}
                  </span>
                )}
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const NavDropdown = ({
  onLayerClick,
  onCategoryClick,
  selectedCategories,
  onClearCategories,
  onTagClick,
  selectedTags,
  onClearTags,
}: Props) => {
  const { t } = useTranslation();
  const layerItems = icebergLayers.map((l) => ({
    id: l.id,
    name: t(`depth.${l.id}` as Parameters<typeof t>[0]),
  }));
  const translatedCategories = allCategories.map((c) => ({
    id: c.id,
    name: t(`category.${c.id}` as Parameters<typeof t>[0]),
  }));
  const hasFilters =
    (selectedCategories && selectedCategories.size > 0) ||
    (selectedTags && selectedTags.size > 0);

  return (
    <nav
      className="flex items-center gap-1 rounded-xl border border-secondary/20 bg-background/60 backdrop-blur-xl px-2 py-0"
      style={{ boxShadow: "0 0 15px rgba(20,241,149,0.1)" }}
    >
      <DropdownSection
        label={t("nav.depth")}
        items={layerItems}
        onSelect={onLayerClick}
      />
      <div className="w-px h-5 bg-secondary/20" />
      <DropdownSection
        label={t("nav.category")}
        items={translatedCategories}
        onSelect={(id) => onCategoryClick?.(id)}
        multiSelect
        selected={selectedCategories as Set<string> | undefined}
        onClear={onClearCategories}
        clearLabel={t("nav.clearFilters")}
      />
      <div className="w-px h-5 bg-secondary/20" />
      <DropdownSection
        label={t("nav.tag")}
        items={allTags}
        onSelect={(id) => onTagClick?.(id)}
        multiSelect
        selected={selectedTags}
        onClear={onClearTags}
        clearLabel={t("nav.clearFilters")}
      />
      {/* Clear-all is desktop-only: on phones it pushed the centered row
          past both viewport edges (back button clipped left, this button
          clipped right). Narrow users still clear from the layer header's
          "Clear filters" pill and each dropdown's own clear row.
          Guarded by e2e/navbar-fit.spec.ts. */}
      {hasFilters && (
        <>
          <div className="hidden sm:block w-px h-5 bg-secondary/20" />
          <button
            onClick={() => {
              onClearCategories?.();
              onClearTags?.();
            }}
            className="hidden sm:flex items-center gap-1 px-2 text-xs font-medium text-foreground/50 hover:text-secondary transition-colors"
            style={{ height: "36px" }}
          >
            <X className="w-3 h-3" />
            {t("nav.clear")}
          </button>
        </>
      )}
    </nav>
  );
};

export default NavDropdown;
