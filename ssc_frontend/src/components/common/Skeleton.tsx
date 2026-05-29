type SkeletonLineProps = {
  className?: string;
};

export function SkeletonLine({ className = "h-4 w-full rounded bg-gray-200/60" }: SkeletonLineProps) {
  return <div className={className + " animate-pulse"} />;
}

export default function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} />
      ))}
    </div>
  );
}
