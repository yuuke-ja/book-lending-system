import { Rating } from '@smastrom/react-rating';
import '@smastrom/react-rating/style.css';

type RatingProps = {
  value?: number;
  maxWidth?: number;
  ratingCount?: number | null;
  showSummaryPanel?: boolean;
  onReviewClick?: () => void;
  compact?: boolean;
};

export default function StarRating({
  value,
  maxWidth = 120,
  ratingCount,
  showSummaryPanel = false,
  onReviewClick,
  compact = false,
}: RatingProps) {
  const safeValue = Number(value ?? 0);

  if (showSummaryPanel) {
    return (
      <div
        className={
          compact
            ? "w-fit"
            : "rounded-lg border border-zinc-200 bg-zinc-50 p-3"
        }
      >
        <div className={compact ? "flex items-center gap-2" : "flex items-center justify-between gap-3"}>
          <div>
            <div className={compact ? "flex items-center gap-1.5" : "mt-1 flex items-center gap-2"}>
              <Rating style={{ maxWidth }} value={safeValue} readOnly />
              <span className={compact ? "text-xs font-semibold text-zinc-800" : "text-sm font-semibold text-zinc-800"}>
                {safeValue.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500">
                ({Number(ratingCount ?? 0)}件)
              </span>
            </div>
          </div>
          {onReviewClick && (
            <button
              type="button"
              onClick={onReviewClick}
              className={
                compact
                  ? "shrink-0 px-1 py-0.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900"
                  : "shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              }
            >
              レビューする
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Rating
      style={{ maxWidth }}
      value={safeValue}

      readOnly />
  );
}
