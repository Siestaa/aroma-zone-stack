import styles from "./ProductThumb.module.css";

// Real Aroma-Zone product photos, replacing the earlier CSS-illustration
// placeholder used during the mock-data phase. Falls back to a plain tinted
// box when a product genuinely has no image (rare — Algolia has one for
// almost every SKU).
export function ProductThumb({
  imageUrl,
  alt,
  size = "md",
  // Source photos are a roughly even mix of square and ~1.6:1 landscape
  // framing (checked a sample of the downloaded catalog), so this box always
  // letterboxes one axis via object-fit: contain — cropping to fill would
  // randomly cut off product packaging depending on which shape a given
  // photo happens to be. The letterbox itself only reads as an ugly "gray
  // stripe" when the thumb sits on a raised card surface (ProductCard,
  // SearchBox's dropdown panel, cart's item list) whose background differs
  // from the thumb's own — pass surface="raised" there so the empty space
  // blends into the card instead. Contexts sitting directly on the page
  // background (the product detail page) keep the default and need no prop.
  surface = "paper",
  className,
}: {
  imageUrl: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  surface?: "paper" | "raised";
  className?: string;
}) {
  const sizeClass = size === "sm" ? styles.sm : size === "lg" ? styles.lg : "";
  const surfaceClass = surface === "raised" ? styles.onRaised : "";

  return (
    <div className={`${styles.thumb} ${sizeClass} ${surfaceClass} ${className ?? ""}`}>
      {imageUrl ? (
         
        // No loading="lazy" here on purpose: this <img> sits inside a
        // <ViewTransition name={`product-thumb-${id}`}> for the catalog<->
        // product-page morph (see ProductCard.tsx / web/CLAUDE.md). Native
        // lazy-loading's visibility heuristic gets confused by
        // ViewTransition's commit choreography and can permanently decide
        // the image is off-screen even when it's plainly visible — the
        // image then just never loads. Confirmed by forcing loading="eager"
        // on a stuck image and watching it load instantly.
        <img src={imageUrl} alt={alt} className={styles.img} />
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}
    </div>
  );
}
