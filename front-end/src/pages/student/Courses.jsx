import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Btn, CourseLoader, Empty, I, Pager, Prog, Reveal, useToast } from '../../lib/ui'
import { Head, money } from './_shared'
function CourseCard({ course, footer, delay = 0, t }) {
  const cover = course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null
  return (
    <Reveal className="card" delay={delay} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 128, position: 'relative', background: cover ? `center/cover url(${cover})` : 'var(--grad)' }}>
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(4,5,14,.85))' }} />
        {course.course_code ? (
          <span className="badge vio" style={{ position: 'absolute', top: 12, left: 12 }}>{course.course_code}</span>
        ) : null}
        {course.no_of_hours ? (
          <span className="badge" style={{ position: 'absolute', top: 12, right: 12 }}>{t('crHours', { n: course.no_of_hours })}</span>
        ) : null}
      </div>
      <div style={{ padding: 20 }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{course.course_name}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', marginBottom: 16 }}>
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
  const toast = useToast()
  const { data, loading, error, run } = useAsync(() => request(`/api/user/courses?page=${page}`), [page])
  const paged = normalizePage(data)
  const paywall = error && (error.status === 403 || /pay/i.test(error.message))

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
      ) : loading ? (
        <CourseLoader label={t('loadingYourCourses')} />
      ) : paged.items.length ? (
        <>
          <div className="grid grid-3">
            {paged.items.map((c, i) => (
              <CourseCard
                key={c.id}
                course={c}
                t={t}
                delay={i * 0.05}
                footer={
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
                      <span>{t('progress')}</span>
                      <span>{t('progressLectures', { done: c.progress, total: c.total_lectures })}</span>
                    </div>
                    <Prog value={c.progress_percent} tone="cy" />
                    <Link to={`/app/student/course/${c.course_id}`} style={{ display: 'block', marginTop: 18 }}>
                      <Btn variant="soft" className="btn-block" iconRight="arrow">{t('continueLearning')}</Btn>
                    </Link>
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
