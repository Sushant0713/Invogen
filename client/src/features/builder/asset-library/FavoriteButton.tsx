import { Star } from 'lucide-react';
import { toggleAssetFavorite } from './sidebar-store';

interface FavoriteButtonProps {
  assetId: string;
  isFavorite: boolean;
  className?: string;
}

export function FavoriteButton({ assetId, isFavorite, className = '' }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      title={isFavorite ? 'Remove from favourites' : 'Pin to favourites'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAssetFavorite(assetId);
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all hover:bg-amber-50 hover:text-amber-500 group-hover/asset:opacity-100 dark:hover:bg-amber-950/40 ${isFavorite ? '!opacity-100 text-amber-500' : ''} ${className}`}
    >
      <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400' : ''}`} />
    </button>
  );
}
