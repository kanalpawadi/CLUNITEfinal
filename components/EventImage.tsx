import React from 'react'
import { ImageIcon } from 'lucide-react'

interface EventImageProps {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  showPlaceholder?: boolean
}

export function EventImage({ 
  src, 
  alt, 
  className = "w-full h-full object-cover",
  fallbackClassName = "w-full h-full flex items-center justify-center bg-background",
  showPlaceholder = true
}: EventImageProps) {
  const [imageError, setImageError] = React.useState(false)
  const [imageLoading, setImageLoading] = React.useState(true)

  // Reset error state when src changes
  React.useEffect(() => {
    setImageError(false)
    setImageLoading(true)
  }, [src])

  const handleImageLoad = () => {
    setImageLoading(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoading(false)
  }

  // If no src provided or image failed to load, show placeholder
  if (!src || imageError) {
    if (!showPlaceholder) {
      return null
    }
    
    return (
      <div className={fallbackClassName}>
        <div className="text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground dark:text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground dark:text-muted-foreground font-medium">
            {imageError ? 'Failed to load image' : 'No image available'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {imageLoading && (
        <div className={fallbackClassName}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${imageLoading ? 'opacity-0 absolute inset-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  )
}
