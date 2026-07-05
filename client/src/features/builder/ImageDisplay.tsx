import type { ImageObjectFit } from './image-components';

interface Props {
  src: string;
  alt: string;
  objectFit?: ImageObjectFit;
}

export function ImageDisplay({ src, alt, objectFit = 'contain' }: Props) {
  const fit = objectFit === 'fill' ? 'fill' : objectFit;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="pointer-events-none block h-full w-full select-none"
      style={{ objectFit: fit }}
    />
  );
}
