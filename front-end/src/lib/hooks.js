import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fnRef.current(...args)
      setData(res)
      return res
    } catch (e) {
      setError(e)
      throw e
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) run().catch(() => {})
  }, [run, immediate])

  return { data, loading, error, run, setData }
}
