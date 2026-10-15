import { useMemo, useState } from 'react'
import { normalizePage, request } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Badge, Btn, Empty, Field, I, Pager, useToast } from '../../lib/ui'
import { useI18n } from '../../lib/i18n'
import { DataTable, FormModal, Head, useFieldErrors, useList, useOptions } from './_shared'

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const emptySched = { level_id: '', semester_id: '', department_id: '', course_id: '', room_id: '', day_of_week: 'Saturday', start_time: '', end_time: '', section_type: 'lecture', image: null }
const emptyRoom = { name: '', building: '', capacity: '' }

function ConflictLine({ c, t }) {
  const day = String(c.day_of_week || '').toLowerCase()
  return (
    <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
      <b>{t('conflict_' + c.type)}</b>
      {' — '}
      {c.course_name || '—'}
      {' · '}
      {t('day_' + day)} {c.start_time}–{c.end_time}
      {c.room ? ` · ${c.room}` : ''}
    </div>
  )
}

export function AdminSchedules() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { paged, loading, run } = useList('/api/schedule/get/all', page)
  const sems = useOptions('/api/semester/get/all', (s) => ({ value: s.id, label: `${s.name} (${s.academic_year})` }))
  const depts = useOptions('/api/department/get/all', (d) => ({ value: d.id, label: d.name }))
  const courses = useOptions('/api/course/get/all', (c) => ({ value: c.id, label: c.course_name }))
  const roomsFetch = useAsync(() => request('/api/room/get/all'))
  const rooms = useMemo(() => normalizePage(roomsFetch.data).items, [roomsFetch.data])

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptySched)
  const [busy, setBusy] = useState(false)
  const [conflicts, setConflicts] = useState([])
  const { errors, clear: clearErrors, apply: applyErrors } = useFieldErrors()

  const [report, setReport] = useState(null)
  const [reportBusy, setReportBusy] = useState(false)

  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [roomBusy, setRoomBusy] = useState(false)
  const { errors: roomErrors, clear: clearRoomErrors, apply: applyRoomErrors } = useFieldErrors()

  const openEdit = (row) => {
    setEditId(row.id)
    setConflicts([])
    setForm({
      level_id: row.level_id || '', semester_id: row.semester_id || '', department_id: row.department_id || '',
      course_id: row.course_id || '', room_id: row.room_id || '',
      day_of_week: row.day_of_week || 'Saturday',
      start_time: (row.start_time || '').slice(0, 5), end_time: (row.end_time || '').slice(0, 5),
      section_type: row.section_type || 'lecture', image: null,
    })
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    try {
      if (editId) {
        const payload = { schedule_id: editId, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, section_type: form.section_type, course_id: Number(form.course_id), level_id: Number(form.level_id), semester_id: Number(form.semester_id) }
        if (form.department_id) payload.department_id = Number(form.department_id)
        if (form.room_id) payload.room_id = Number(form.room_id)
        const res = await request('/api/schedule/update', { method: 'POST', data: payload })
        if (res?.warnings?.length) toast.info(t('scheduleSavedWarn'))
      } else {
        const fd = new FormData()
        fd.append('level_id', form.level_id)
        fd.append('semester_id', form.semester_id)
        if (form.department_id) fd.append('department_id', form.department_id)
        fd.append('course_id', form.course_id)
        if (form.room_id) fd.append('room_id', form.room_id)
        fd.append('day_of_week', form.day_of_week)
        fd.append('start_time', form.start_time)
        fd.append('end_time', form.end_time)
        fd.append('section_type', form.section_type)
        if (form.image) fd.append('image', form.image)
        const res = await request('/api/schedule/store', { method: 'POST', formData: fd })
        if (res?.warnings?.length) toast.info(t('scheduleSavedWarn'))
      }
      toast.success(t('scheduleSaved'))
      setOpen(false)
      clearErrors()
      setConflicts([])
      run().catch(() => {})
      if (report !== null) loadReport()
    } catch (e) {
      const cs = e?.payload?.data?.conflicts
      if (Array.isArray(cs) && cs.length) {
        setConflicts(cs)
        toast.error(t('scheduleConflict'))
      } else if (!applyErrors(e)) {
        toast.error(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(t('confirmDeleteEntry'))) return
    try {
      await request(`/api/schedule/delete/${row.id}`, { method: 'DELETE' })
      toast.success(t('entryDeleted'))
      run().catch(() => {})
      if (report !== null) loadReport()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const loadReport = async () => {
    setReportBusy(true)
    try {
      const res = await request('/api/schedule/conflicts')
      setReport(res?.conflicts || [])
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReportBusy(false)
    }
  }

  const saveRoom = async () => {
    setRoomBusy(true)
    try {
      await request('/api/room/store', {
        method: 'POST',
        data: {
          name: roomForm.name,
          building: roomForm.building || null,
          capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
        },
      })
      toast.success(t('roomAdded'))
      setRoomForm(emptyRoom)
      clearRoomErrors()
      roomsFetch.run().catch(() => {})
    } catch (e) {
      if (!applyRoomErrors(e)) toast.error(e.message)
    } finally {
      setRoomBusy(false)
    }
  }

  const removeRoom = async (room) => {
    if (!window.confirm(t('confirmDeleteRoom'))) return
    try {
      await request(`/api/room/delete/${room.id}`, { method: 'DELETE' })
      toast.success(t('roomDeleted'))
      roomsFetch.run().catch(() => {})
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Head
        kicker={t('timetable')}
        title={t('schedules')}
        sub={t('schedulesSub')}
        actions={
          <>
            <Btn variant="soft" icon="clock" loading={reportBusy} onClick={loadReport}>{t('checkConflicts')}</Btn>
            <Btn icon="plus" onClick={() => { setEditId(null); setForm(emptySched); setConflicts([]); clearErrors(); setOpen(true) }}>{t('newEntry')}</Btn>
          </>
        }
      />

      {report !== null ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-head">
            <div>
              <div style={{ fontWeight: 600 }}>{t('existingConflicts')}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t('existingConflictsSub')}</div>
            </div>
            <Badge tone={report.length ? 'vio' : 'grn'}>{report.length}</Badge>
          </div>
          {report.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {report.map((c, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge tone="vio">{t('conflict_' + c.type)}</Badge>
                    <span style={{ fontSize: '0.75rem', color: 'var(--faint)' }}>#{c.a.id} · #{c.b.id}</span>
                  </div>
                  <ConflictLine c={c.a} t={t} />
                  <ConflictLine c={c.b} t={t} />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="check" title={t('noConflicts')} />
          )}
        </div>
      ) : null}

      <DataTable
        loading={loading}
        rows={paged.items}
        columns={[
          { key: 'course', label: t('course'), main: true, render: (r) => r.course?.course_name || '—' },
          { key: 'level', label: t('level'), render: (r) => r.level?.name || r.level_id || '—' },
          { key: 'semester', label: t('semester'), render: (r) => r.semester?.name || '—' },
          { key: 'department', label: t('department'), render: (r) => r.department?.name || t('general') },
          { key: 'room', label: t('room'), render: (r) => r.room?.name || <span style={{ color: 'var(--faint)' }}>{t('noRoom')}</span> },
          { key: 'day_of_week', label: t('day'), render: (r) => <Badge tone="vio">{t('day_' + String(r.day_of_week).toLowerCase())}</Badge> },
          { key: 'time', label: t('time'), render: (r) => `${(r.start_time || '').slice(0, 5)} – ${(r.end_time || '').slice(0, 5)}` },
          { key: 'section_type', label: t('type'), render: (r) => <Badge tone="cy">{t('type_' + String(r.section_type).toLowerCase())}</Badge> },
        ]}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Pager page={paged.page} last={paged.last_page} onPage={setPage} />

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-head">
          <div>
            <div style={{ fontWeight: 600 }}>{t('roomManagement')}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t('roomManagementSub')}</div>
          </div>
          <Badge tone="vio">{rooms.length}</Badge>
        </div>
        <div className="grid grid-3" style={{ gap: 14 }}>
          <Field label={t('roomName')} error={roomErrors?.name?.[0]}>
            <input className="input" value={roomForm.name} placeholder={t('roomNamePh')} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} />
          </Field>
          <Field label={t('roomBuilding')} error={roomErrors?.building?.[0]}>
            <input className="input" value={roomForm.building} placeholder={t('roomBuildingPh')} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })} />
          </Field>
          <Field label={t('roomCapacity')} error={roomErrors?.capacity?.[0]}>
            <input className="input" type="number" min="1" value={roomForm.capacity} placeholder="e.g. 40" onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn icon="plus" loading={roomBusy} onClick={saveRoom}>{t('addRoom')}</Btn>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {rooms.length ? rooms.map((r) => (
            <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 999, padding: '6px 14px' }}>
              <I name="building" size={14} />
              <span style={{ fontSize: '0.82rem' }}>
                {r.name}{r.building ? ` · ${r.building}` : ''}{r.capacity ? ` · ${r.capacity}` : ''}
              </span>
              <Btn size="sm" variant="danger" icon="trash" onClick={() => removeRoom(r)} />
            </span>
          )) : (
            <Empty icon="building" title={t('noRooms')} />
          )}
        </div>
      </div>

      <FormModal open={open} onClose={() => setOpen(false)} title={editId ? t('editEntry') : t('newEntryTitle')} onSubmit={submit} busy={busy} errors={errors} onFormClose={clearErrors}>
        {conflicts.length ? (
          <div className="form-alert" role="alert" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('scheduleConflict')}</span>
            {conflicts.map((c, i) => <ConflictLine key={i} c={c} t={t} />)}
          </div>
        ) : null}
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('levelId')} hint={t('levelIdHint')} error={errors?.level_id?.[0]}><input className="input" type="number" min="1" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} placeholder="e.g. 1" /></Field>
          <Field label={t('semester')} error={errors?.semester_id?.[0]}>
            <select className="select" value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {sems.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('course')} error={errors?.course_id?.[0]}>
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">{t('select')}</option>
              {courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={t('departmentOptional')} error={errors?.department_id?.[0]}>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('generalOption')}</option>
              {depts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('roomOptional')} error={errors?.room_id?.[0]}>
            <select className="select" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
              <option value="">{t('noRoom')}</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.building ? ` · ${r.building}` : ''}</option>)}
            </select>
          </Field>
          <Field label={t('sectionType')} error={errors?.section_type?.[0]}>
            <select className="select" value={form.section_type} onChange={(e) => setForm({ ...form, section_type: e.target.value })}>
              <option value="lecture">{t('lectureType')}</option>
              <option value="seminar">{t('seminar')}</option>
              <option value="lab">{t('lab')}</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('day')} error={errors?.day_of_week?.[0]}>
            <select className="select" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{t('day_' + d.toLowerCase())}</option>)}
            </select>
          </Field>
          <Field label={t('startTime')} error={errors?.start_time?.[0]}><input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label={t('endTime')} error={errors?.end_time?.[0]}><input className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
          {!editId ? <Field label={t('timetableImageOptional')} error={errors?.image?.[0]}><input className="input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} /></Field> : null}
        </div>
      </FormModal>
    </>
  )
}
