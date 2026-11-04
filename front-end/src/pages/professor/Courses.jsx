import { Link } from 'react-router-dom'
import { CoverImage } from '../../lib/media'
import { Badge, Btn, CourseLoader, Empty, Reveal } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { ProfHero, totalStudents, useMyCourses } from './_shared'

const ACTIONS = [
  { to: 'students', icon: 'users', key: 'students' },
  { to: 'lectures', icon: 'file', key: 'lectures' },
  { to: 'quizzes', icon: 'award', key: 'quizzes' },
  { to: 'grades', icon: 'chart', key: 'grades' },
]

export function ProfessorCourses() {
  const { t } = useI18n()
  const { courses, loading } = useMyCourses()

  const lectureTotal = courses.reduce((sum, course) => sum + (course.lectures?.length || 0), 0)
  const creditTotal = courses.reduce((sum, course) => sum + (Number(course.no_of_hours) || 0), 0)

  return (
    <>
      <ProfHero
        eyebrow={t('teaching')}
        title={t('myCourses')}
        sub={t('myCoursesSub')}
        stats={[
          { label: t('myCourses'), value: courses.length },
          { label: t('lecturesUploaded'), value: lectureTotal },
          { label: t('studentsTaught'), value: loading ? '—' : totalStudents(courses) },
          { label: t('totalCreditHours'), value: creditTotal },
        ]}
      />

      {loading ? (
        <CourseLoader label={t('loadingYourCourses')} />
      ) : courses.length ? (
        <div className="grid grid-3">
          {courses.map((course, index) => (
            <Reveal key={course.id} className="card course-card prof-course-card" delay={index * 0.05}>
              <CoverImage
                className="course-cover"
                src={course.cover_image && !course.cover_image.endsWith('default.jpg') ? course.cover_image : null}
                alt={course.course_name}
                icon="book"
                mark={course.course_code}
              >
                <span className="course-cover-veil" />
                {course.course_code ? <span className="course-code">{course.course_code}</span> : null}
                {course.no_of_hours ? <span className="course-hours">{t('crHours', { n: course.no_of_hours })}</span> : null}
              </CoverImage>
              <div className="course-body">
                <h3>{course.course_name}</h3>
                <p className="course-prof">
                  <span>{course.department?.name || t('general')}</span>
                </p>
                <div className="std-chips">
                  <Badge tone="cy">{t('lecturesCount', { n: course.lectures?.length || 0 })}</Badge>
                  <Badge tone="vio">
                    {t('studentsCount', { n: Number(course.students_count) || 0 })}
                  </Badge>
                  {course.capacity ? <Badge>{t('capacity')}: {course.capacity}</Badge> : null}
                </div>
                <div className="prof-course-actions">
                  {ACTIONS.map((action) => (
                    <Link key={action.to} to={`/app/professor/${action.to}?course=${course.id}`}>
                      <Btn size="sm" variant="soft" className="btn-block" icon={action.icon}>
                        {t(action.key)}
                      </Btn>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty icon="book" title={t('noCoursesAssigned')} sub={t('noCoursesAssignedSub')} />
      )}
    </>
  )
}
