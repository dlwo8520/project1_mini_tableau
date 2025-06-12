export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-card border border-gray-100 ${className}`}
      {...props}
    />
  );
}
export const CardHeader = props => (
  <div className="px-4 py-3 border-b text-sm font-semibold" {...props} />
);
export const CardContent = props => (
  <div className="px-4 py-3" {...props} />
);
