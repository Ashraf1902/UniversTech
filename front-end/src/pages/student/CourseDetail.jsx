import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { CoverImage } from '../../lib/media'
import { Badge, Btn, CourseLoader, Empty, I, Reveal, Ring, useToast } from '../../lib/ui'

export function StudentCourseDetail() {
  const { id } = useParams()
  const { t } = useI18n()
  const toast = useToast()
  const { data: course, loading, error } = useAsync(() => request(`/api/user/course/${id}`), [id])
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
  if (!course) {
    if (error?.status === 403) {
      return (
        <Empty
          icon="wallet"
          title={t('unlockCourses')}
          sub={t('courseLockedSub')}
          action={
            <Link to="/app/student/payments">
              <Btn variant="soft" icon="wallet">{t('viewPayments')}</Btn>
            </Link>
          }
        />
      )
    }
    return <Empty icon="book" title={t('courseNotFound')} />
  }

  const cover = course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null
  const progress = Math.max(0, Math.min(100, Math.round(Number(course.progress_percent) || 0)))

  return (
    <>
      <Reveal className="std-course-hero">
        <CoverImage className="std-course-hero-art" src={cover} alt={course.course_name} icon="book" mark={course.course_code}>
          <span className="std-course-hero-veil" />
        </CoverImage>
        <div className="std-course-hero-inner">
          <div>
            <span className="std-eyebrow">{t('course')} · {course.course_code || '—'}</span>
            <h1>{course.course_name}</h1>
            <div className="std-chips">
              <Badge tone="cy"><I name="user" size={12} /> {course.course_professor || t('noProfessor')}</Badge>
              <Badge><I name="clock" size={12} /> {t('creditHrs', { n: course.no_of_hours })}</Badge>
              <Badge tone="vio"><I name="file" size={12} /> {t('totalCount', { n: course.total_lectures || 0 })}</Badge>
            </div>
          </div>
          <div className="std-course-hero-progress">
            <Ring value={progress} max={100} size={104} label={`${progress}%`} sub={t('progress')} />
          </div>
        </div>
      </Reveal>

      <div className="std-course-grid">
        <div className="std-course-main">
          <Reveal className="card">
            <div className="card-head">
              <h3>{t('lectures')}</h3>
              <Badge tone="cy">{t('totalCount', { n: course.lectures?.length || 0 })}</Badge>
            </div>
            {course.lectures?.length ? (
              <ol className="std-lectures">
                {course.lectures.map((lecture, index) => {
                  const done = watched[lecture.id]
                  return (
                    <li className={`std-lecture ${done ? 'is-done' : ''}`} key={lecture.id}>
                      <span className="std-lecture-index">
                        {done ? <I name="check" size={16} /> : String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="std-lecture-body">
                        <strong>{lecture.lecture_name}</strong>
                        <span>{done ? t('watched') : t('notStarted')}</span>
                      </div>
                      <Btn size="sm" variant="soft" icon="play" onClick={() => watch(lecture)}>{t('watch')}</Btn>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <Empty icon="file" title={t('noLecturesYet')} sub={t('noLecturesYetSub')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.06}>
            <div className="card-head">
              <h3>{t('quizzes')}</h3>
              <Badge tone="pnk">{t('totalCount', { n: course.quizzes?.length || 0 })}</Badge>
            </div>
            {course.quizzes?.length ? (
              <div>
                {course.quizzes.map((quiz) => (
                  <div className="list-row" key={quiz.id}>
                    <span className="std-quiz-icon tone-pnk" style={{ width: 38, height: 38 }}>
                      <I name="award" size={17} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{quiz.name}</div>
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-faint)' }}>
                        {quiz.due_at ? t('due', { date: new Date(quiz.due_at).toLocaleDateString() }) : t('noDueDate')}
                      </div>
                    </div>
                    <a href={quiz.content} target="_blank" rel="noreferrer">
                      <Btn size="sm" variant="soft" icon="file">{t('openAction')}</Btn>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="award" title={t('noQuizzes')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>{t('announcements')}</h3>
              <Badge tone="vio">{t('totalCount', { n: course.announcements?.length || 0 })}</Badge>
            </div>
            {course.announcements?.length ? (
              course.announcements.map((a) => (
                <div className="list-row" key={a.id} style={{ alignItems: 'flex-start' }}>
                  <span className="std-dispatch-icon" style={{ width: 38, height: 38 }}>
                    <I name="info" size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{a.title}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 6, whiteSpace: 'pre-line' }}>{a.body}</div>
                    <div className="std-chips" style={{ marginTop: 10 }}>
                      {a.author ? <Badge tone="cy">{t('profPrefix')} {a.author}</Badge> : null}
                      {a.created_at ? <Badge>{a.created_at}</Badge> : null}
                      {a.attachment ? (
                        <a href={a.attachment} target="_blank" rel="noreferrer" className="badge amb">
                          <I name="file" size={12} /> {t('attachment')}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Empty icon="info" title={t('noAnnouncements')} sub={t('noAnnouncementsSub')} />
            )}
          </Reveal>
        </div>

        <aside className="std-course-side">
          <Reveal className="card">
            <div className="card-head">
              <h3>{t('courseSummary')}</h3>
            </div>
            <dl className="std-facts">
              <div><dt>{t('code')}</dt><dd>{course.course_code || '—'}</dd></div>
              <div><dt>{t('creditHours')}</dt><dd>{course.no_of_hours ?? '—'}</dd></div>
              <div><dt>{t('professor')}</dt><dd>{course.course_professor || t('noProfessor')}</dd></div>
              <div><dt>{t('lectures')}</dt><dd>{course.total_lectures ?? 0}</dd></div>
              <div><dt>{t('quizzes')}</dt><dd>{course.quizzes?.length ?? 0}</dd></div>
              <div><dt>{t('announcements')}</dt><dd>{course.announcements?.length ?? 0}</dd></div>
            </dl>
          </Reveal>

          <Reveal className="card" delay={0.06}>
            <Link to="/app/student/courses" style={{ display: 'block' }}>
              <Btn variant="soft" icon="chevron" style={{ width: '100%', transform: 'scaleX(-1)' }}>{t('back')}</Btn>
            </Link>
          </Reveal>
        </aside>
      </div>
    </>
  )
}
