import { motion } from "framer-motion";
import { hex } from "../lib/theme";

const PIECES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 220,
  y: -60 - Math.random() * 130,
  r: Math.random() * 360,
  d: 0.5 + Math.random() * 0.45,
}));

const PALETTE = ["mint", "sky", "pink", "amber", "violet", "coral"];

export default function Confetti({ colorKey = "mint" }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
      <div className="relative w-0 h-0">
      {PIECES.map((p, i) => (
        <motion.span
          key={p.id}
          className="absolute block rounded-[2px]"
          style={{
            width: 7,
            height: 11,
            background: i % 3 === 0 ? hex(colorKey) : hex(PALETTE[i % PALETTE.length]),
          }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.r, scale: 0.6 }}
          transition={{ duration: p.d + 0.35, ease: "easeOut" }}
        />
      ))}
      </div>
    </div>
  );
}
