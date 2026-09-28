import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, CourseLoader, Empty, I, Reveal, Ring, useToast } from '../../lib/ui'
import { Head } from './_shared'
export function StudentCourseDetail() {
  const { id } = useParams()
  const { t } = useI18n()
  const toast = useToast()
  const { data: course, loading } = useAsync(() => request(`/api/user/course/${id}`), [id])
  const [watched, setWatched] = useState({})

  const watch = async (lecture) => {
    try {
      await request('/api/user/update_progress', { method: 'PUT', data: { course_id: Number(id), lecture_id: lecture.id } })
      setWatched((w) => ({ ...w, [lecture.id]: true }))
      if (lecture.content) window.open(lecture.content, '_blank', 'noopener')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return <CourseLoader label={t('openingCourse')} />
  if (!course) return <Empty icon="book" title={t('courseNotFound')} />

  return (
    <>
      <Head kicker={t('course')} title={course.course_name} sub={`${course.course_code || ''} · ${course.course_professor || t('noProfessor')}`} actions={<Link to="/app/student/courses"><Btn variant="ghost" icon="chevron" style={{ transform: 'scaleX(-1)' }}>{t('back')}</Btn></Link>} />

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card">
            <div className="card-head">
              <h3>{t('lectures')}</h3>
              <Badge tone="cy">{t('totalCount', { n: course.lectures?.length || 0 })}</Badge>
            </div>
            {course.lectures?.length ? (
              course.lectures.map((l, i) => {
                const done = watched[l.id]
                return (
                  <div className="list-row" key={l.id}>
                    <span className="av" style={{ background: done ? 'rgba(52,245,162,.16)' : 'var(--grad)', color: done ? '#8af7c7' : '#fff', width: 40, height: 40 }}>
                      {done ? <I name="check" size={17} /> : i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{l.lecture_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{done ? t('watched') : t('notStarted')}</div>
                    </div>
                    <Btn size="sm" variant="soft" icon="play" onClick={() => watch(l)}>{t('watch')}</Btn>
                  </div>
                )
              })
            ) : (
              <Empty icon="file" title={t('noLecturesYet')} sub={t('noLecturesYetSub')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>{t('quizzes')}</h3>
              <Badge tone="pnk">{t('totalCount', { n: course.quizzes?.length || 0 })}</Badge>
            </div>
            {course.quizzes?.length ? (
              course.quizzes.map((q) => (
                <div className="list-row" key={q.id}>
                  <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6', width: 40, height: 40 }}>
                    <I name="award" size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{q.due_at ? t('due', { date: new Date(q.due_at).toLocaleDateString() }) : t('noDueDate')}</div>
                  </div>
                  <a href={q.content} target="_blank" rel="noreferrer">
                    <Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn>
                  </a>
                </div>
              ))
            ) : (
              <Empty icon="award" title={t('noQuizzes')} />
            )}
          </Reveal>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" style={{ textAlign: 'center' }}>
            <div style={{ height: 130, borderRadius: 14, marginBottom: 18, background: course.cover_image && !course.cover_image.endsWith('default.jpg') ? `center/cover url(${course.cover_image})` : 'var(--grad)' }} />
            <div className="gpa-meter" style={{ justifyContent: 'center' }}>
              <Ring value={course.progress_percent || 0} max={100} label={`${Math.round(course.progress_percent || 0)}%`} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{t('progress')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>{t('acrossLectures')}</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  )
}
