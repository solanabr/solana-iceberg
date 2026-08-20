/**
 * AnimatedList — reactbits.dev
 * Staggered fade-in list items with framer-motion.
 * Used for search result dropdowns.
 */
import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";

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
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {children.map((child, i) => (
          <motion.div
            key={i}
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
