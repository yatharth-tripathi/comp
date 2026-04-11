import { motion } from "framer-motion";

interface Comparison {
  product: string;
  returns: string;
}

interface Props {
  title: string;
  comparisons: Comparison[];
}

export function ComparisonRow({ title, comparisons }: Props): JSX.Element {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y rounded-2xl border bg-card">
        {comparisons.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-medium">{c.product}</span>
            <span className="font-semibold tabular-nums">{c.returns}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
