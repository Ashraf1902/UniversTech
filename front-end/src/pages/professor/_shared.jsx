import { useState } from 'react'
import { getFieldErrors, normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Field } from '../../lib/ui'

export function useFieldErrors() {
  const [errors, setErrors] = useState({})
  return {
    errors,
    setErrors,
    clear: () => setErrors({}),
    apply: (err) => {
      const fe = getFieldErrors(err)
      if (fe && Object.keys(fe).length) {
        setErrors(fe)
        return true
      }
      return false
    },
  }
}

export function Head({ kicker, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {sub ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function useMyCourses() {
  const { data, loading } = useAsync(() => request('/api/professors/courses'))
  const paged = normalizePage(data)
  return { courses: paged.items, loading }
}

export function CourseSelect({ courses, value, onChange, loading }) {
  return (
    <Field label="Course">
      <select className="select" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} disabled={loading}>
        <option value="">{loading ? 'Loading courses…' : '— Select a course —'}</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.course_name} {c.course_code ? `(${c.course_code})` : ''}
          </option>
        ))}
      </select>
    </Field>
  )
}
