import { useEffect, useState } from 'react'
import { storage } from './storage'

export function useMedia(assetId?: string) {
  const [asset, setAsset] = useState<{ id: string; url?: string }>()
  useEffect(() => {
    if (!assetId) return
    let active = true
    let url: string | undefined
    void storage.asset(assetId).then(asset => {
      if (!active) return
      if (asset) url = URL.createObjectURL(asset.blob)
      setAsset({ id: assetId, url })
    }).catch(() => { if (active) setAsset({ id: assetId }) })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [assetId])
  return { url: asset?.id === assetId ? asset?.url : undefined, missing: asset?.id === assetId && !!assetId && !asset?.url }
}
