/**
 * AnimatedList — reactbits.dev
 * Staggered fade-in list items with framer-motion.
 * Used for search result dropdowns.
 */
import { motion, AnimatePresence } from "framer-motion";
import { isValidElement, type ReactNode } from "react";

interface AnimatedListProps {
  children: ReactNode[];
  className?: string;
  delay?: number;
}

export default function AnimatedList({
  children,
  className = "",
  delay = 0.05,
}: AnimatedListProps) {
  return (
    /* role="presentation" on both wrappers: the search dropdown renders this
       inside a role="listbox" whose children are role="option", and an
       unmarked generic element between the two breaks that ownership. */
    <div className={className} role="presentation">
      <AnimatePresence mode="popLayout">
        {children.map((child, i) => (
          <motion.div
            /* Prefer the child's own key over the array index. Index keys make
               AnimatePresence track the wrong element as the list changes, so
               exit animations played on whichever row happened to land at that
               position rather than the one actually leaving. Callers already
               supply stable keys. */
            key={isValidElement(child) && child.key != null ? child.key : i}
            role="presentation"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{
              duration: 0.2,
              delay: i * delay,
              ease: "easeOut",
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
