import { useMemo, useState } from 'react'
import { buildQuery, downloadFile, normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, StatCard } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, Head, useOptions } from './_shared'

const REPORTS = {
  enrollment: '/api/report/enrollment',
  payments: '/api/report/payments',
  attendance: '/api/report/attendance',
  unassigned: '/api/report/unassigned',
}

const FILTERS = {
  enrollment: ['semester_id', 'department_id', 'level_id'],
  payments: ['semester_id', 'department_id', 'level_id', 'date_from', 'date_to'],
  attendance: ['semester_id', 'department_id', 'level_id', 'course_id'],
  unassigned: [],
}

const EXPORTABLE = ['enrollment', 'payments', 'attendance']

const TYPES = ['enrollment', 'payments', 'attendance', 'unassigned']

export function AdminReports() {
  const { t } = useI18n()
  const [tab, setTab] = useState('enrollment')
  const [filters, setFilters] = useState({})

  const semesters = useOptions('/api/semester/get/all', (s) => ({ value: String(s.id), label: `${s.name} (${s.academic_year})` }))
  const { data: meta } = useAsync(() => request('/api/public/meta'))
  const departments = (meta?.departments || []).map((d) => ({ value: String(d.id), label: d.name }))
  const levels = (meta?.levels || []).map((l) => ({ value: String(l.id), label: l.name }))
  const { data: courseData } = useAsync(() => request('/api/course/get/all?page=1'))
  const courses = useMemo(
    () => normalizePage(courseData).items.map((c) => ({ value: String(c.id), label: `${c.course_code} - ${c.course_name}` })),
    [courseData]
  )

  const active = FILTERS[tab]
  const params = useMemo(() => {
    const out = {}
    active.forEach((k) => {
      if (filters[k]) out[k] = filters[k]
    })
    return out
  }, [active, filters])

  const qs = buildQuery(params)
  const { data, loading } = useAsync(() => request(`${REPORTS[tab]}${qs}`), [tab, qs])

  const optionSets = {
    semester_id: { label: t('semester'), options: semesters },
    department_id: { label: t('department'), options: departments },
    level_id: { label: t('level'), options: levels },
    course_id: { label: t('course'), options: courses },
  }

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const switchTab = (next) => {
    setTab(next)
    setFilters({})
  }

  const exportCsv = () => downloadFile(`${REPORTS[tab]}${qs}${qs ? '&' : '?'}export=csv`)

  return (
    <>
      <Head
        kicker={t('results')}
        title={t('reports')}
        sub={t('reportsSub')}
        actions={
          EXPORTABLE.includes(tab) ? (
            <Btn variant="soft" icon="download" onClick={exportCsv}>
              {t('exportCsv')}
            </Btn>
          ) : null
        }
      />

      <div className="seg" style={{ marginBottom: 22, maxWidth: 480 }}>
        {TYPES.map((type) => (
          <button key={type} className={tab === type ? 'on' : ''} onClick={() => switchTab(type)}>
            {type === 'enrollment'
              ? t('enrollmentReport')
              : type === 'payments'
              ? t('paymentsReport')
              : type === 'attendance'
              ? t('attendanceReport')
              : t('unassignedReport')}
          </button>
        ))}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {active
          .filter((k) => optionSets[k])
          .map((k) => (
            <div key={k}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>{optionSets[k].label}</label>
              <select className="select" value={filters[k] || ''} onChange={(e) => setFilter(k, e.target.value)}>
                <option value="">{t('allOption')}</option>
                {optionSets[k].options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        {tab === 'payments' ? (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>{t('dateFrom')}</label>
              <input className="input" type="date" value={filters.date_from || ''} onChange={(e) => setFilter('date_from', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>{t('dateTo')}</label>
              <input className="input" type="date" value={filters.date_to || ''} onChange={(e) => setFilter('date_to', e.target.value)} />
            </div>
          </>
        ) : null}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>{t('loadingRecords')}</p>
      ) : !data ? (
        <Empty icon="chart" title={t('noRecordsYet')} />
      ) : tab === 'enrollment' ? (
        <EnrollmentReport data={data} />
      ) : tab === 'payments' ? (
        <PaymentsReport data={data} />
      ) : tab === 'attendance' ? (
        <AttendanceReport data={data} />
      ) : (
        <UnassignedReport data={data} />
      )}
    </>
  )
}

function EnrollmentReport({ data }) {
  const { t } = useI18n()
  const totals = data.totals || {}
  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <StatCard icon="book" label={t('courses')} value={totals.courses ?? 0} tone="vio" />
        <StatCard icon="users" label={t('enrollmentsLabel')} value={totals.enrollments ?? 0} tone="cy" />
        <StatCard icon="check" label={t('registered')} value={totals.registered ?? 0} tone="grn" />
        <StatCard icon="cap" label={t('capacity')} value={totals.capacity ?? 0} tone="amb" />
      </div>
      <DataTable
        rows={data.rows || []}
        columns={[
          { key: 'course_name', label: t('courseName'), main: true },
          { key: 'course_code', label: t('courseCode') },
          { key: 'department', label: t('department'), render: (r) => r.department || '—' },
          { key: 'capacity', label: t('capacity'), render: (r) => r.capacity ?? '—' },
          { key: 'registered', label: t('registered') },
          { key: 'dropped', label: t('dropped') },
          { key: 'completed', label: t('completed') },
          { key: 'failed', label: t('failed') },
          { key: 'total', label: t('total') },
          { key: 'capacity_usage', label: t('capacityUsage'), render: (r) => (r.capacity_usage == null ? '—' : `${r.capacity_usage}%`) },
        ]}
      />
    </>
  )
}

function PaymentsReport({ data }) {
  const { t } = useI18n()
  const totals = data.totals || {}
  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <StatCard icon="wallet" label={t('paymentsCount')} value={totals.count ?? 0} tone="vio" />
        <StatCard icon="trend" label={t('collected')} value={totals.collected ?? 0} tone="grn" />
        <StatCard icon="clock" label={t('pending')} value={totals.pending ?? 0} tone="amb" />
        <StatCard icon="x" label={t('refunded')} value={totals.refunded ?? 0} tone="red" />
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('byStatus')}</h3></div>
          <DataTable
            rows={data.by_status || []}
            columns={[
              { key: 'status', label: t('status'), main: true },
              { key: 'count', label: t('paymentsCount') },
              { key: 'total', label: t('total') },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('byDepartment')}</h3></div>
          <DataTable
            rows={data.by_department || []}
            columns={[
              { key: 'department', label: t('department'), main: true },
              { key: 'count', label: t('paymentsCount') },
              { key: 'collected', label: t('collected') },
            ]}
          />
        </div>
      </div>
      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-head"><h3>{t('byPeriod')}</h3></div>
        <DataTable
          rows={data.by_period || []}
          columns={[
            { key: 'period', label: t('period'), main: true },
            { key: 'count', label: t('paymentsCount') },
            { key: 'total', label: t('total') },
            { key: 'collected', label: t('collected') },
          ]}
        />
      </div>
    </>
  )
}

function AttendanceReport({ data }) {
  const { t } = useI18n()
  const totals = data.totals || {}
  const thresholds = data.thresholds || {}
  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <StatCard icon="book" label={t('courses')} value={totals.courses ?? 0} tone="vio" />
        <StatCard icon="file" label={t('records')} value={totals.records ?? 0} tone="cy" />
        <StatCard icon="check" label={t('present')} value={totals.present ?? 0} tone="grn" />
        <StatCard icon="x" label={t('absent')} value={totals.absent ?? 0} tone="red" sub={`${t('absencePercent')}: ${totals.absence_percentage ?? 0}%`} />
      </div>
      <p style={{ color: 'var(--faint)', fontSize: '0.82rem', marginBottom: 18 }}>
        {t('thresholdHint', { warn: thresholds.warn ?? 0, bar: thresholds.bar ?? 0 })}
      </p>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head"><h3>{t('byCourse')}</h3></div>
        <DataTable
          rows={data.rows || []}
          columns={[
            { key: 'course_name', label: t('courseName'), main: true },
            { key: 'course_code', label: t('courseCode') },
            { key: 'sessions', label: t('sessions') },
            { key: 'records', label: t('records') },
            { key: 'present', label: t('present') },
            { key: 'absent', label: t('absent') },
            { key: 'absence_percentage', label: t('absencePercent'), render: (r) => `${r.absence_percentage}%` },
          ]}
        />
      </div>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head"><h3>{t('byLevel')}</h3></div>
        <DataTable
          rows={data.levels || []}
          columns={[
            { key: 'level', label: t('level'), main: true },
            { key: 'records', label: t('records') },
            { key: 'absent', label: t('absent') },
            { key: 'absence_percentage', label: t('absencePercent'), render: (r) => `${r.absence_percentage}%` },
          ]}
        />
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('studentsOverThreshold')}</h3></div>
        <DataTable
          rows={data.students_over_threshold || []}
          columns={[
            { key: 'student_name', label: t('studentName'), main: true },
            { key: 'course_name', label: t('courseName') },
            { key: 'records', label: t('records') },
            { key: 'absent', label: t('absent') },
            { key: 'absence_percentage', label: t('absencePercent'), render: (r) => `${r.absence_percentage}%` },
            {
              key: 'status',
              label: t('status'),
              render: (r) => (r.status === 'barred' ? <Badge tone="red" dot>{t('barred')}</Badge> : <Badge tone="amb" dot>{t('warning')}</Badge>),
            },
          ]}
        />
      </div>
    </>
  )
}

function UnassignedReport({ data }) {
  const { t } = useI18n()
  const totals = data.totals || {}
  return (
    <>
      <div className="grid grid-2" style={{ marginBottom: 22 }}>
        <StatCard icon="book" label={t('unassignedCourses')} value={totals.courses ?? 0} tone="amb" />
        <StatCard icon="file" label={t('unassignedEnrollments')} value={totals.enrollments ?? 0} tone="cy" />
      </div>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head"><h3>{t('unassignedCourses')}</h3></div>
        <DataTable
          rows={data.courses || []}
          columns={[
            { key: 'course_name', label: t('courseName'), main: true },
            { key: 'course_code', label: t('courseCode') },
            { key: 'department', label: t('department'), render: (r) => r.department || '—' },
            { key: 'professor', label: t('professor'), render: (r) => r.professor || '—' },
          ]}
        />
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('unassignedEnrollments')}</h3></div>
        <DataTable
          rows={data.enrollments || []}
          columns={[
            { key: 'student_name', label: t('studentName'), main: true },
            { key: 'course_name', label: t('courseName') },
            { key: 'status', label: t('status') },
          ]}
        />
      </div>
    </>
  )
}
