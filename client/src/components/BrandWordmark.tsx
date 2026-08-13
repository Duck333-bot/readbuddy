export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display ${className}`}>
      <span className="relative flex h-5 w-4 items-center justify-center" aria-hidden="true">
        <span className="rb-thread absolute h-4 rotate-[28deg]" />
        <span className="rb-thread-node relative" />
      </span>
      <span className="inline-flex items-baseline gap-[1px]">
        <span className="font-semibold">Read</span>
        <span className="font-normal italic text-primary">Buddy</span>
      </span>
    </span>
  );
}
