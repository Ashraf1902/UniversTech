import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, CourseLoader, Empty, I, Reveal, Ring, useToast } from '../../lib/ui'
import { Head } from './_shared'
export function StudentCourseDetail() {
  const { id } = useParams()
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

  if (loading) return <CourseLoader label="Opening course…" />
  if (!course) return <Empty icon="book" title="Course not found" />

  return (
    <>
      <Head kicker="Course" title={course.course_name} sub={`${course.course_code || ''} · ${course.course_professor || 'No professor'}`} actions={<Link to="/app/student/courses"><Btn variant="ghost" icon="chevron" style={{ transform: 'scaleX(-1)' }}>Back</Btn></Link>} />

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card">
            <div className="card-head">
              <h3>Lectures</h3>
              <Badge tone="cy">{course.lectures?.length || 0} total</Badge>
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
                      <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{done ? 'Watched' : 'Not started'}</div>
                    </div>
                    <Btn size="sm" variant="soft" icon="play" onClick={() => watch(l)}>Watch</Btn>
                  </div>
                )
              })
            ) : (
              <Empty icon="file" title="No lectures yet" sub="Your professor has not uploaded any lectures." />
            )}
          </Reveal>

          <Reveal className="card" delay={0.08}>
            <div className="card-head">
              <h3>Quizzes</h3>
              <Badge tone="pnk">{course.quizzes?.length || 0} total</Badge>
            </div>
            {course.quizzes?.length ? (
              course.quizzes.map((q) => (
                <div className="list-row" key={q.id}>
                  <span className="av" style={{ background: 'rgba(245,99,176,.16)', color: '#ffb0d6', width: 40, height: 40 }}>
                    <I name="award" size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{q.due_at ? `Due ${new Date(q.due_at).toLocaleDateString()}` : 'No due date'}</div>
                  </div>
                  <a href={q.content} target="_blank" rel="noreferrer">
                    <Btn size="sm" variant="soft" icon="file">Open</Btn>
                  </a>
                </div>
              ))
            ) : (
              <Empty icon="award" title="No quizzes yet" />
            )}
          </Reveal>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Reveal className="card" style={{ textAlign: 'center' }}>
            <div style={{ height: 130, borderRadius: 14, marginBottom: 18, background: course.cover_image && !course.cover_image.endsWith('default.jpg') ? `center/cover url(${course.cover_image})` : 'var(--grad)' }} />
            <div className="gpa-meter" style={{ justifyContent: 'center' }}>
              <Ring value={course.progress_percent || 0} max={100} label={`${Math.round(course.progress_percent || 0)}%`} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Progress</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>across lectures</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  )
}
