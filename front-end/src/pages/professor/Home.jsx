import { Link } from 'react-router-dom'
import { normalizePage, request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync, useUniversityTimezone } from '../../lib/hooks'
import { formatDate, formatTime, nextLecture, nowInTimezone, timeToMinutes } from '../../lib/timetable'
import { Badge, Btn, Empty, I, Reveal, Spinner } from '../../lib/ui'
import { ProfHero, useMyCourses, useRosterTotals } from './_shared'

const QUICK_LINKS = [
  { to: '/app/professor/lectures', icon: 'upload', key: 'uploadLecture' },
  { to: '/app/professor/quizzes', icon: 'award', key: 'quizzes' },
  { to: '/app/professor/grades', icon: 'chart', key: 'grades' },
  { to: '/app/professor/announcements', icon: 'info', key: 'announcements' },
]

function MiniEmpty({ icon, title, sub }) {
  return (
    <div className="home-empty">
      <span className="home-empty-icon">
        <I name={icon} size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </div>
  )
}

export function ProfessorHome() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const timezone = useUniversityTimezone()

  const profile = useAsync(() => request('/api/professor/profile'))
  const { courses, loading: coursesLoading } = useMyCourses()
  const roster = useRosterTotals(courses)
  const schedule = useAsync(() => request('/api/professor/schedule'))
  const appeals = useAsync(() => request('/api/professor/appeal/get/all?status=pending&page=1'))
  const notifs = useAsync(() => request('/api/professor/notifications?page=1'))

  const p = profile.data
  const rows = schedule.data?.schedule || []
  const pending = normalizePage(appeals.data)
  const notes = normalizePage(notifs.data)
  const lectureTotal = courses.reduce((sum, course) => sum + (course.lectures?.length || 0), 0)

  const now = nowInTimezone(timezone)
  const todayRows = rows
    .filter((row) => String(row.day_of_week || '').toLowerCase() === now.weekday)
    .sort((a, b) => (timeToMinutes(a.start_time) ?? 0) - (timeToMinutes(b.start_time) ?? 0))
  const next = nextLecture(rows, timezone)
  const firstName = user?.name?.split(' ').slice(-1)[0] || t('profPrefix')

  return (
    <>
      <ProfHero
        eyebrow={t('facultyConsole')}
        title={t('helloProf', { name: firstName })}
        sub={`${p?.job_title || t('facultyMember')} · ${p?.department?.name || t('university')} — ${t('manageLine')}`}
        stats={[
          { label: t('myCourses'), value: courses.length },
          { label: t('lecturesUploaded'), value: lectureTotal },
          { label: t('studentsTaught'), value: roster.loading ? '—' : roster.total },
          { label: t('gradeAppeals'), value: appeals.loading ? '—' : pending.total },
        ]}
        aside={
          <div className="home-next">
            <span className="home-next-label">
              <I name="calendar" size={15} /> {t('nextLecture')}
            </span>
            {next ? (
              <>
                <strong>{next.row.course_name}</strong>
                <span className="home-next-time">
                  {formatDate(next.date, lang, timezone, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                  {formatTime(next.row.start_time, timezone)}–{formatTime(next.row.end_time, timezone)}
                </span>
                <div className="home-next-tags">
                  {next.row.course_code ? <Badge>{next.row.course_code}</Badge> : null}
                  {next.row.section_type ? (
                    <Badge tone="cy">{t('type_' + String(next.row.section_type).toLowerCase())}</Badge>
                  ) : null}
                  {next.row.room ? (
                    <Badge tone="vio">
                      <I name="building" size={12} /> {next.row.room}
                    </Badge>
                  ) : null}
                  {next.live ? <Badge tone="grn" dot>{t('lectureNow')}</Badge> : null}
                </div>
              </>
            ) : (
              <div className="home-next-empty">
                <strong>{t('nextLectureNone')}</strong>
                <span>{t('nextLectureNoneSub')}</span>
              </div>
            )}
          </div>
        }
      >
        <div className="prof-quick">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="prof-quick-link">
              <span className="prof-quick-icon">
                <I name={link.icon} size={17} />
              </span>
              {t(link.key)}
            </Link>
          ))}
        </div>
      </ProfHero>

      <div className="home-grid">
        <div className="home-col">
          <Reveal className="card">
            <div className="card-head">
              <div>
                <h3>{t('todayLectures')}</h3>
                <span className="home-card-sub">
                  {formatDate(now.date, lang, timezone, { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <Link to="/app/professor/timetable" className="home-link">
                {t('viewSchedule')} <I name="arrow" size={14} />
              </Link>
            </div>
            {schedule.loading ? (
              <Spinner size={22} />
            ) : todayRows.length ? (
              <div className="home-lectures">
                {todayRows.map((row, index) => {
                  const start = timeToMinutes(row.start_time)
                  const end = timeToMinutes(row.end_time)
                  const live = start != null && end != null && start <= now.minutes && end > now.minutes
                  return (
                    <div key={row.id ?? index} className={`lecture-row is-${live ? 'now' : 'later'}`}>
                      <div className="lecture-time">
                        <strong>{formatTime(row.start_time, timezone)}</strong>
                        <span>{formatTime(row.end_time, timezone)}</span>
                      </div>
                      <span className="lecture-bar" />
                      <div className="lecture-body">
                        <strong>{row.course_name}</strong>
                        <span>
                          {row.course_code || '—'}
                          {row.section_type ? ` · ${t('type_' + String(row.section_type).toLowerCase())}` : ''}
                          {row.room ? ` · ${row.room}` : ''}
                        </span>
                      </div>
                      {live ? <Badge tone="grn" dot>{t('lectureNow')}</Badge> : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty icon="calendar" title={t('noLecturesThisDay')} sub={t('noTimetableSub')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.05}>
            <div className="card-head">
              <div>
                <h3>{t('myCourses')}</h3>
                <span className="home-card-sub">{t('myCoursesSub')}</span>
              </div>
              <Link to="/app/professor/courses" className="home-link">
                {t('manage')} <I name="arrow" size={14} />
              </Link>
            </div>
            {coursesLoading ? (
              <Spinner size={22} />
            ) : courses.length ? (
              <div className="home-lectures">
                {courses.slice(0, 5).map((course) => (
                  <div key={course.id} className="lecture-row prof-course-row">
                    <span className="prof-course-mark">{String(course.course_code || course.course_name || '?').slice(0, 2)}</span>
                    <div className="lecture-body">
                      <strong>{course.course_name}</strong>
                      <span>
                        {course.department?.name || t('general')} · {t('lecturesCount', { n: course.lectures?.length || 0 })}
                        {roster.counts[course.id] != null ? ` · ${t('studentsCount', { n: roster.counts[course.id] })}` : ''}
                      </span>
                    </div>
                    <Link to={`/app/professor/grades?course=${course.id}`}>
                      <Btn size="sm" variant="soft" icon="chart">{t('grades')}</Btn>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="book" title={t('noCoursesAssigned')} sub={t('noCoursesAssignedSub')} />
            )}
          </Reveal>
        </div>

        <div className="home-col home-col-side">
          <Reveal className="card" delay={0.06}>
            <div className="card-head">
              <h3>{t('awaitingReply')}</h3>
              <Link to="/app/professor/appeals" className="home-link">
                {t('all')} <I name="arrow" size={14} />
              </Link>
            </div>
            {appeals.loading ? (
              <Spinner size={20} />
            ) : pending.items.length ? (
              <div className="std-appeal-list">
                {pending.items.slice(0, 3).map((appeal) => (
                  <div key={appeal.id} className="std-appeal">
                    <div className="std-appeal-head">
                      <div>
                        <strong>{appeal.student}</strong>
                        <span className="std-appeal-date">{appeal.course || '—'}</span>
                      </div>
                      <Badge tone="amb" dot>{t('status_pending')}</Badge>
                    </div>
                    <p className="std-appeal-reason">{appeal.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <MiniEmpty icon="mail" title={t('noPendingAppeals')} sub={t('noPendingAppealsSub')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.1}>
            <div className="card-head">
              <h3>{t('notifications')}</h3>
              <Link to="/app/professor/notifications" className="home-link">
                {t('viewAll')} <I name="arrow" size={14} />
              </Link>
            </div>
            {notifs.loading ? (
              <Spinner size={20} />
            ) : notes.items.length ? (
              <div className="home-notices">
                {notes.items.slice(0, 3).map((note) => (
                  <div key={note.id} className="home-notice">
                    <span className="home-notice-icon">
                      <I name={note.type === 'event' ? 'spark' : 'bell'} size={16} />
                    </span>
                    <div>
                      <strong>{note.title}</strong>
                      <small>{note.created_at}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MiniEmpty icon="bell" title={t('noNotifications')} />
            )}
          </Reveal>

          <Reveal className="card" delay={0.14}>
            <div className="card-head">
              <h3>{t('teachingLoad')}</h3>
              <span className="home-card-sub">{t('thisTerm')}</span>
            </div>
            {courses.length ? (
              <div className="prof-load-list">
                {courses.slice(0, 4).map((course) => (
                  <div key={course.id} className="prof-load-row">
                    <div>
                      <strong>{course.course_name}</strong>
                      <span>
                        {course.department?.name || t('general')} · {t('lecturesCount', { n: course.lectures?.length || 0 })}
                      </span>
                    </div>
                    <Badge tone="cy">
                      {roster.counts[course.id] != null ? t('studentsCount', { n: roster.counts[course.id] }) : '—'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <MiniEmpty icon="book" title={t('noCoursesAssigned')} />
            )}
          </Reveal>
        </div>
      </div>
    </>
  )
}
