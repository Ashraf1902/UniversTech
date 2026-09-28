import { Link } from 'react-router-dom'
import { Badge, Btn, CourseLoader, Empty, Reveal } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { Head, useMyCourses } from './_shared'
export function ProfessorCourses() {
  const { t } = useI18n()
  const { courses, loading } = useMyCourses()
  return (
    <>
      <Head kicker={t('teaching')} title={t('myCourses')} sub={t('myCoursesSub')} />
      {loading ? (
        <CourseLoader label={t('loadingYourCourses')} />
      ) : courses.length ? (
        <div className="grid grid-3">
          {courses.map((c, i) => (
            <Reveal key={c.id} className="card" delay={i * 0.05}>
              <div style={{ height: 110, borderRadius: 14, marginBottom: 18, background: c.cover_image && !c.cover_image.endsWith('default.jpg') ? `center/cover url(${c.cover_image})` : 'var(--grad)' }} />
              <h3 style={{ fontSize: '1.02rem', marginBottom: 6 }}>{c.course_name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {c.course_code ? <Badge tone="vio">{c.course_code}</Badge> : null}
                <Badge tone="cy">{t('lecturesCount', { n: c.lectures?.length || 0 })}</Badge>
                {c.no_of_hours ? <Badge>{t('crHours', { n: c.no_of_hours })}</Badge> : null}
              </div>
              <div className="grid grid-2" style={{ gap: 8 }}>
                <Link to={`/app/professor/students?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="users">{t('students')}</Btn></Link>
                <Link to={`/app/professor/lectures?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="file">{t('lectures')}</Btn></Link>
                <Link to={`/app/professor/quizzes?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="award">{t('quizzes')}</Btn></Link>
                <Link to={`/app/professor/grades?course=${c.id}`}><Btn size="sm" variant="soft" className="btn-block" icon="chart">{t('grades')}</Btn></Link>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="book" title={t('noCoursesAssigned')} />
      )}
    </>
  )
}
