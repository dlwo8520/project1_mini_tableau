export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm border ${className}`}
      {...props}
    />
  );
}
export const CardHeader = props => (
  <div className="px-4 py-2 border-b text-sm font-semibold" {...props} />
);
export const CardContent = props => (
  <div className="px-4 py-2" {...props} />
);
