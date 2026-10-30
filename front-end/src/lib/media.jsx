import { useEffect, useState } from 'react'
import { I } from './ui'

/**
 * Image with a branded indigo/gold fallback.
 *
 * If `src` is missing or fails to load, the fallback is shown instead, so a
 * stale or missing cover/event file never renders as a broken-image icon.
 */
export function CoverImage({ src, alt = '', className = '', icon = 'book', mark, children }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const showImage = Boolean(src) && !failed

  return (
    <div className={`media-cover ${className}`.trim()}>
      <span className="media-cover-fallback" aria-hidden="true">
        <span className="media-cover-mark">
          <I name={icon} size={18} />
        </span>
        {mark ? <span className="media-cover-mark-text">{mark}</span> : null}
      </span>
      {showImage ? (
        <img
          className="media-cover-img"
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : null}
      {children}
    </div>
  )
}
