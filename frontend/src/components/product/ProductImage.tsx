import { useState } from 'react';
import { Package } from 'lucide-react';
import './product-image.css';

type Props = {
  imageUrl?: string | null;
  name: string;
  size?: 'thumbnail' | 'preview' | 'catalog';
  loading?: 'eager' | 'lazy';
};

function ImageContent({ imageUrl, name, loading }: Props) {
  const [failed, setFailed] = useState(false);
  return imageUrl && !failed
    ? <img src={imageUrl} alt={name} loading={loading} decoding="async" onError={() => setFailed(true)} />
    : <Package aria-hidden="true" />;
}

export default function ProductImage({ size = 'thumbnail', loading = 'lazy', ...props }: Props) {
  return <span className={`product-image product-image--${size}`}>
    <ImageContent key={props.imageUrl ?? 'missing'} {...props} loading={loading} />
  </span>;
}
