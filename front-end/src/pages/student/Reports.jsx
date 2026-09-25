import { request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Empty, Prog, RateBadge, Reveal, Ring, Spinner } from '../../lib/ui'
import { Head } from './_shared'
export function StudentReports() {
  const { data, loading } = useAsync(() => request('/api/user/reports'))
  if (loading) return <Spinner size={26} />
  const overall = data?.overall || {}
  const cards = data?.semester_cards || []
  const courses = data?.courses || []

  return (
    <>
      <Head kicker="Performance" title="Reports & GPA" sub="Per-semester final scores with letter rates, and your cumulative GPA across all graded subjects." />

      <Reveal className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gpa-meter">
            <Ring value={overall.cumulative_gpa || 0} max={4} size={104} label={overall.cumulative_gpa ?? '—'} sub="CGPA" />
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Cumulative GPA</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>{overall.cumulative_gpa ?? '—'} / 4.0</div>
              {overall.rate ? <RateBadge rate={overall.rate} /> : null}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Graded courses</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_graded_courses ?? 0}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Credit hours</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{overall.total_credit_hours ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        {cards.length ? (
          cards.map((c, i) => (
            <Reveal key={c.semester?.id ?? i} className="card" delay={i * 0.08}>
              <div className="card-head">
                <div>
                  <h3 style={{ marginBottom: 4 }}>{c.semester?.name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>
                    {c.semester?.academic_year} · {c.semester?.grading_system === 'fixed_term' ? 'Fixed-Term' : 'Credit-Hour'} system
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem' }}>
                    {c.final_score?.type === 'fixed_term' ? `${c.final_score?.percentage}%` : c.final_score?.gpa}
                  </div>
                  <RateBadge rate={c.final_score?.rate} />
                </div>
              </div>
              <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
                <table className="table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Marks</th>
                      <th>%</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.courses || []).map((row) => (
                      <tr key={row.course_id}>
                        <td className="cell-main">{row.course_name}<div style={{ fontSize: '0.74rem', color: 'var(--faint)', fontWeight: 400 }}>{row.course_code} · {row.credit_hours} cr</div></td>
                        <td>{row.marks}/{row.max_marks}</td>
                        <td style={{ minWidth: 110 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Prog value={row.percentage} sm />
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', minWidth: 36 }}>{row.percentage}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}><RateBadge rate={row.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          ))
        ) : (
          <Reveal className="card" style={{ gridColumn: '1 / -1' }}>
            <Empty icon="award" title="No results yet" sub="Your semester cards will appear here once grades are recorded." />
          </Reveal>
        )}
      </div>

      <Reveal className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h3>Attendance & progress</h3>
        </div>
        {courses.length ? (
          <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
            <table className="table">
              <thead>
                <tr><th>Course</th><th>Progress</th><th>Present</th><th>Absent</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const pct = c.total_lectures ? Math.round((c.progress / c.total_lectures) * 100) : 0
                  return (
                    <tr key={c.course_name}>
                      <td className="cell-main">{c.course_name}</td>
                      <td style={{ minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Prog value={pct} tone="cy" sm />
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{pct}%</span>
                        </div>
                      </td>
                      <td><Badge tone="grn">{c.present}</Badge></td>
                      <td><Badge tone={c.absent ? 'red' : ''}>{c.absent}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="chart" title="No data yet" />
        )}
      </Reveal>
    </>
  )
}
