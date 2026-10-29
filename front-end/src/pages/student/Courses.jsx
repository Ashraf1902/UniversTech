import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, CourseLoader, Empty, I, Pager, Prog, Reveal, useToast } from '../../lib/ui'
import { DemoBanner, Head, money } from './_shared'

function coursePct(course) {
  const raw = course.progress_percent ?? (course.total_lectures ? (course.progress / course.total_lectures) * 100 : 0)
  return Math.max(0, Math.min(100, Math.round(Number(raw) || 0)))
}

function CourseCard({ course, footer, delay = 0, t }) {
  const cover = course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null
  const progress = coursePct(course)

  return (
    <Reveal className="card course-card" delay={delay}>
      <div className={`course-cover ${cover ? 'has-image' : ''}`} style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        <span className="course-cover-veil" />
        {course.course_code ? <span className="course-code">{course.course_code}</span> : null}
        {course.no_of_hours ? <span className="course-hours">{t('crHours', { n: course.no_of_hours })}</span> : null}
        <span className="course-progress-badge">
          <Prog value={progress} sm />
          <b>{progress}%</b>
        </span>
      </div>
      <div className="course-body">
        <h3>{course.course_name}</h3>
        <p className="course-prof">
          <I name="user" size={14} />
          {course.professor || course.course_professor || t('noProfessorAssigned')}
        </p>
        {footer}
      </div>
    </Reveal>
  )
}

export function StudentCourses() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [dropping, setDropping] = useState(null)
  const toast = useToast()
  const { data, loading, error, run } = useAsync(() => request(`/api/user/courses?page=${page}`), [page])
  const paged = normalizePage(data)
  const paywall = error && (error.status === 403 || /pay/i.test(error.message))

  const items = paged.items
  const credits = items.reduce((sum, c) => sum + (Number(c.no_of_hours) || 0), 0)
  const avgProgress = items.length
    ? Math.round(
        items.reduce((sum, c) => {
          const pct = coursePct(c)
          return sum + pct
        }, 0) / items.length,
      )
    : 0

  const drop = async (c) => {
    if (!window.confirm(t('confirmDropCourse', { name: c.course_name }))) return
    setDropping(c.id)
    try {
      await request('/api/user/drop-course', { method: 'POST', data: { course_id: c.course_id } })
      toast.success(t('courseDropped'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDropping(null)
    }
  }

  const pay = async (type) => {
    try {
      await request('/api/user/make-payment', { method: 'POST', data: { type } })
      toast.success(t('paymentSuccess'))
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker={t('myLearning')}
        title={t('myCourses')}
        sub={t('studentCoursesSub')}
        actions={
          <Link to="/app/student/catalog">
            <Btn icon="plus">{t('registerCourses')}</Btn>
          </Link>
        }
      />

      {paywall ? (
        <>
          <DemoBanner />
          <Reveal className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div className="eic" style={{ margin: '0 auto 16px' }}>
              <I name="wallet" size={26} />
            </div>
            <h3>{t('unlockCourses')}</h3>
            <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '10px auto 24px' }}>
              {t('unlockCoursesSub')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Btn icon="wallet" onClick={() => pay('courses')}>{t('payCourses', { amount: money(700) })}</Btn>
              <Btn variant="ghost" icon="wallet" onClick={() => pay('year')}>{t('payYear', { amount: money(575) })}</Btn>
            </div>
          </Reveal>
        </>
      ) : loading ? (
        <CourseLoader label={t('loadingYourCourses')} />
      ) : items.length ? (
        <>
          <Reveal className="course-stats">
            <div>
              <span>{t('registeredCourses')}</span>
              <strong>{paged.total}</strong>
            </div>
            <div>
              <span>{t('creditsEnrolled', { n: credits })}</span>
              <strong>{credits}</strong>
            </div>
            <div>
              <span>{t('averageProgress')}</span>
              <strong>{avgProgress}%</strong>
            </div>
            <Link to="/app/student/catalog" className="course-stats-action">
              <I name="plus" size={16} /> {t('registerCourses')}
            </Link>
          </Reveal>

          <div className="grid grid-3">
            {items.map((c, i) => (
              <CourseCard
                key={c.id}
                course={c}
                t={t}
                delay={i * 0.05}
                footer={
                  <>
                    <div className="course-progress-row">
                      <span>{t('progress')}</span>
                      <span>{t('progressLectures', { done: c.progress, total: c.total_lectures })}</span>
                    </div>
                    <Prog
                      value={coursePct(c)}
                      tone="cy"
                    />
                    <div className="course-actions">
                      <Link to={`/app/student/course/${c.course_id}`} className="course-continue">
                        <Btn variant="soft" className="btn-block" iconRight="arrow">{t('continueLearning')}</Btn>
                      </Link>
                      <Btn
                        variant="ghost"
                        icon="trash"
                        loading={dropping === c.id}
                        onClick={() => drop(c)}
                        aria-label={t('dropCourse')}
                      />
                    </div>
                  </>
                }
              />
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="book" title={t('notRegisteredTitle')} sub={t('notRegisteredSub')} action={<Link to="/app/student/catalog"><Btn>{t('openCatalog')}</Btn></Link>} />
      )}
    </>
  )
}
