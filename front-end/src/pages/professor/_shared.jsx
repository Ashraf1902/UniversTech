import { useState } from 'react'
import { getFieldErrors, normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Field } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'

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

/**
 * Indigo/gold hero shared by the professor pages. Mirrors the student
 * `.std-hero` block: a white title (never gradient), an optional aside
 * (next lecture, ring, note) and an optional numeric strip.
 */
export function ProfHero({ eyebrow, title, sub, aside, stats, actions, children }) {
  return (
    <section className={`std-hero prof-hero ${aside ? '' : 'is-wide'}`}>
      <div className="std-hero-body">
        <span className="std-eyebrow">{eyebrow}</span>
        <h1 className="prof-hero-title">{title}</h1>
        {sub ? <p className="prof-hero-sub">{sub}</p> : null}
        {children}
        {actions ? <div className="prof-hero-actions">{actions}</div> : null}
        {stats?.length ? (
          <dl className="std-hero-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {aside ? <div className="std-hero-ring">{aside}</div> : null}
    </section>
  )
}

export function useMyCourses() {
  const { data, loading } = useAsync(() => request('/api/professors/courses'))
  const paged = normalizePage(data)
  return { courses: paged.items, loading, total: paged.total }
}

/**
 * Real per-course roster sizes. The API only exposes one course at a time,
 * so the count is fetched per owned course (there are never many) instead of
 * inventing a `students_count` field the backend does not return.
 */
export function useRosterTotals(courses) {
  const key = courses.map((c) => c.id).join(',')
  const { data, loading } = useAsync(async () => {
    if (!courses.length) return {}
    const lists = await Promise.all(
      courses.map((course) =>
        request('/api/professors/course/student?course_id=' + course.id).catch(() => []),
      ),
    )
    const map = {}
    courses.forEach((course, index) => {
      map[course.id] = Array.isArray(lists[index]) ? lists[index].length : 0
    })
    return map
  }, [key])

  const counts = data || {}
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  return { counts, total, loading }
}

export function CourseSelect({ courses, value, onChange, loading }) {
  const { t } = useI18n()
  return (
    <Field label={t('course')}>
      <select className="select" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} disabled={loading}>
        <option value="">{loading ? t('loadingCourses') : t('chooseCourseOption')}</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.course_name} {c.course_code ? `(${c.course_code})` : ''}
          </option>
        ))}
      </select>
    </Field>
  )
}
