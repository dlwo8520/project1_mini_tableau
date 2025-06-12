// src/components/ui/card.jsx
import cls from "classnames";

export function Card({ className, ...props }) {
  return <div className={cls("rounded-xl border bg-white shadow", className)} {...props} />;
}
export function CardHeader({ className, ...props }) {
  return <header className={cls("px-6 py-4 font-semibold", className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cls("px-6 py-4", className)} {...props} />;
}
