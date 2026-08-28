import Image from "next/image";

export function IpadProductVisual({ className = "" }: { className?: string }) {
  return (
    <div className={`ipad-product-frame ${className}`.trim()} aria-hidden="true">
      <Image
        className="ipad-product-image"
        src="/images/ipad-real.png"
        width={900}
        height={900}
        alt=""
        priority
        unoptimized
      />
    </div>
  );
}
