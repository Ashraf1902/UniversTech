import { Link } from 'react-router-dom'
import { Badge, Btn, CourseLoader, Empty, Reveal } from '../../lib/ui'
import { Head, useMyCourses } from './_shared'
export function ProfessorCourses() {
  const { courses, loading } = useMyCourses()
  return (
    <>
      <Head kicker="Teaching" title="My courses" sub="Jump into any course to manage its students, lectures, quizzes, and grades." />
      {loading ? (
        <CourseLoader label="Loading your courses…" />
      ) : courses.length ? (
        <div className="grid grid-3">
          {courses.map((c, i) => (
            <Reveal key={c.id} className="card" delay={i * 0.05}>
              <div style={{ height: 110, borderRadius: 14, marginBottom: 18, background: c.cover_image && !c.cover_image.endsWith('default.jpg') ? `center/cover url(${c.cover_image})` : 'var(--grad)' }} />
              <h3 style={{ fontSize: '1.02rem', marginBottom: 6 }}>{c.course_name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                <Badge tone="cy">{c.lectures?.length || 0} lectures</Badge>
                {c.no_of_hours ? <Badge>{c.no_of_hours} cr</Badge> : null}
              </div>
              <div className="grid grid-2" style={{ gap: 8 }}>
                <Link to={`/app/professor/students?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="users">Students</Btn></Link>
                <Link to={`/app/professor/lectures?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="file">Lectures</Btn></Link>
                <Link to={`/app/professor/quizzes?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="award">Quizzes</Btn></Link>
                <Link to={`/app/professor/grades?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="chart">Grades</Btn></Link>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="book" title="No courses assigned" />
      )}
    </>
  )
}
