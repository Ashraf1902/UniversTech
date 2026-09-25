import { useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Btn, CourseLoader, Empty, I, Pager, Prog, Reveal, useToast } from '../../lib/ui'
import { Head, money } from './_shared'
function CourseCard({ course, footer, delay = 0 }) {
  const cover = course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null
  return (
    <Reveal className="card" delay={delay} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 128, position: 'relative', background: cover ? `center/cover url(${cover})` : 'var(--grad)' }}>
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(4,5,14,.85))' }} />
        {course.course_code ? (
          <span className="badge vio" style={{ position: 'absolute', top: 12, left: 12 }}>{course.course_code}</span>
        ) : null}
        {course.no_of_hours ? (
          <span className="badge" style={{ position: 'absolute', top: 12, right: 12 }}>{course.no_of_hours} cr</span>
        ) : null}
      </div>
      <div style={{ padding: 20 }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{course.course_name}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', marginBottom: 16 }}>
          {course.professor || course.course_professor || 'No professor assigned'}
        </p>
        {footer}
      </div>
    </Reveal>
  )
}

export function StudentCourses() {
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { data, loading, error, run } = useAsync(() => request(`/api/user/courses?page=${page}`), [page])
  const paged = normalizePage(data)
  const paywall = error && (error.status === 403 || /pay/i.test(error.message))

  const pay = async (type) => {
    try {
      await request('/api/user/make-payment', { method: 'POST', data: { type } })
      toast.success('Payment successful. Your courses are unlocked!')
      run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker="My learning"
        title="My courses"
        sub="Everything you are enrolled in this term, with live progress."
        actions={
          <Link to="/app/student/catalog">
            <Btn icon="plus">Register courses</Btn>
          </Link>
        }
      />

      {paywall ? (
        <Reveal className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="eic" style={{ margin: '0 auto 16px' }}>
            <I name="wallet" size={26} />
          </div>
          <h3>Unlock your registered courses</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '10px auto 24px' }}>
            You have not paid for your courses yet. Choose a plan below to unlock lectures, quizzes, and progress tracking.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn icon="wallet" onClick={() => pay('courses')}>Pay {money(700)} — Courses</Btn>
            <Btn variant="ghost" icon="wallet" onClick={() => pay('year')}>Pay {money(575)} — Year</Btn>
          </div>
        </Reveal>
      ) : loading ? (
        <CourseLoader label="Loading your courses…" />
      ) : paged.items.length ? (
        <>
          <div className="grid grid-3">
            {paged.items.map((c, i) => (
              <CourseCard
                key={c.id}
                course={c}
                delay={i * 0.05}
                footer={
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
                      <span>Progress</span>
                      <span>{c.progress}/{c.total_lectures} lectures</span>
                    </div>
                    <Prog value={c.progress_percent} tone="cy" />
                    <Link to={`/app/student/course/${c.course_id}`} style={{ display: 'block', marginTop: 18 }}>
                      <Btn variant="soft" className="btn-block" iconRight="arrow">Continue learning</Btn>
                    </Link>
                  </>
                }
              />
            ))}
          </div>
          <Pager page={paged.page} last={paged.last_page} onPage={setPage} />
        </>
      ) : (
        <Empty icon="book" title="You are not registered in any course" sub="Browse the catalog and register for this semester's courses." action={<Link to="/app/student/catalog"><Btn>Open catalog</Btn></Link>} />
      )}
    </>
  )
}
