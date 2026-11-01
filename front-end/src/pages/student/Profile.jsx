import { useState } from 'react'
import { request } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAsync } from '../../lib/hooks'
import { Avatar, Badge, Btn, Empty, I, Reveal, Spinner } from '../../lib/ui'
import ChangePasswordModal from '../../layout/ChangePasswordModal'
import { Head } from './_shared'

const STATUS_META = {
  active: { key: 'statusActive', tone: 'grn' },
  suspended: { key: 'statusSuspended', tone: 'red' },
  graduated: { key: 'statusGraduated', tone: 'vio' },
  inactive: { key: 'statusInactive', tone: '' },
}

function Fact({ label, children }) {
  const { t } = useI18n()
  const hasValue = children !== null && children !== undefined && children !== ''
  return (
    <div>
      <dt>{label}</dt>
      <dd>{hasValue ? children : <span className="std-missing">{t('profileNotProvided')}</span>}</dd>
    </div>
  )
}

export function StudentProfile() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, loading } = useAsync(() => request('/api/user'))
  const [pwdOpen, setPwdOpen] = useState(false)

  const profile = data || user
  if (!profile) return loading ? <Spinner size={26} /> : <Empty icon="user" title={t('profileNotProvided')} />

  const status = STATUS_META[profile.status] || STATUS_META.active
  const gender = profile.gender === 'Female' ? t('female') : profile.gender === 'Male' ? t('male') : profile.gender
  const semester = profile.semester === 'first' ? t('first') : profile.semester === 'second' ? t('second') : profile.semester

  return (
    <>
      <Head kicker={t('profileKicker')} title={t('myProfile')} sub={t('profileSub')} />

      <Reveal className="std-hero std-hero--profile">
        <div className="std-profile-id">
          <Avatar name={profile.name || '?'} size={76} radius={22} />
          <div>
            <span className="std-eyebrow">{t('profileKicker')}</span>
            <h2>{profile.name || '—'}</h2>
            <p>{profile.email || t('profileNotProvided')}</p>
            <div className="std-chips">
              <Badge tone="cy" dot>{t('student')}</Badge>
              <Badge tone={status.tone}>{t(status.key)}</Badge>
              {profile.level?.name ? <Badge>{profile.level.name}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="std-profile-note">
          <I name="lock" size={16} />
          <span>{t('profileReadOnly')}</span>
        </div>
      </Reveal>

      <div className="std-profile-grid">
        <Reveal className="card std-profile-card">
          <div className="card-head">
            <h3>{t('profileIdentity')}</h3>
            <Badge>{t('profileReadOnlyBadge')}</Badge>
          </div>
          <dl className="std-facts">
            <Fact label={t('name')}>{profile.name}</Fact>
            <Fact label={t('email')}>{profile.email}</Fact>
            <Fact label={t('nationalId')}>{profile.national_id}</Fact>
            <Fact label={t('gender')}>{gender}</Fact>
          </dl>
        </Reveal>

        <Reveal className="card std-profile-card" delay={0.05}>
          <div className="card-head">
            <h3>{t('profileAcademic')}</h3>
            <Badge>{t('profileReadOnlyBadge')}</Badge>
          </div>
          <dl className="std-facts">
            <Fact label={t('department')}>{profile.department?.name}</Fact>
            <Fact label={t('level')}>{profile.level?.name}</Fact>
            <Fact label={t('semester')}>{semester}</Fact>
            <Fact label={t('creditPoints')}>{profile.credit_points}</Fact>
            <Fact label={t('status')}>{t(status.key)}</Fact>
          </dl>
        </Reveal>

        <Reveal className="card std-profile-card" delay={0.1}>
          <div className="card-head">
            <h3>{t('profileContact')}</h3>
            <Badge>{t('profileReadOnlyBadge')}</Badge>
          </div>
          <dl className="std-facts">
            <Fact label={t('phone')}>{profile.phone}</Fact>
            <Fact label={t('email')}>{profile.email}</Fact>
          </dl>
          <p className="std-card-sub" style={{ marginTop: 12 }}>{t('profileReadOnly')}</p>
        </Reveal>
      </div>

      <Reveal className="card std-profile-card" style={{ marginTop: 16 }} delay={0.12}>
        <div className="std-security">
          <span className="std-security-icon">
            <I name="shield" size={21} />
          </span>
          <div className="std-security-copy">
            <strong>{t('profileSecurity')}</strong>
            <p>{t('profileSecuritySub')}</p>
          </div>
          <Btn variant="soft" icon="lock" onClick={() => setPwdOpen(true)}>{t('changePassword')}</Btn>
        </div>
      </Reveal>

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} role="student" />
    </>
  )
}
