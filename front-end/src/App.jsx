import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import DashboardLayout, { RoleGate } from './layout/DashboardLayout'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { Loader, ToastProvider } from './lib/ui'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import {
  StudentAttendance, StudentCatalog, StudentCourseDetail, StudentCourses, StudentHome, StudentNotifications, StudentPayments, StudentReports, StudentSchedule, StudentQuizzes,
} from './pages/student'
import {
  ProfessorAnnouncements, ProfessorAppeals, ProfessorCourses, ProfessorGrades, ProfessorHome, ProfessorLectures, ProfessorNotifications, ProfessorQuizzes, ProfessorSchedule, ProfessorStudents,
} from './pages/professor'
import {
  AdminAccounts, AdminAccessRequests, AdminActivity, AdminAdmins, AdminAnnouncements, AdminAppeals, AdminAttendance, AdminCourses, AdminDepartments, AdminEvents, AdminGrades, AdminHome, AdminPayments, AdminSchedules, AdminSemesters, AdminRollover, AdminSettings,
} from './pages/admin'

function UnauthorizedListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const onUnauthorized = () => navigate('/login', { replace: true })
    window.addEventListener('ut:unauthorized', onUnauthorized)
    return () => window.removeEventListener('ut:unauthorized', onUnauthorized)
  }, [navigate])
  return null
}

function Boot({ children }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900)
    return () => clearTimeout(t)
  }, [])
  if (!ready) return <Loader />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <Boot>
              <UnauthorizedListener />
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                  path="/app/student"
                  element={
                    <RoleGate role="student">
                      <DashboardLayout role="student" />
                    </RoleGate>
                  }
                >
                  <Route index element={<StudentHome />} />
                  <Route path="courses" element={<StudentCourses />} />
                  <Route path="catalog" element={<StudentCatalog />} />
                  <Route path="course/:id" element={<StudentCourseDetail />} />
          <Route path="schedule" element={<StudentSchedule />} />
          <Route path="attendance" element={<StudentAttendance />} />
                  <Route path="quizzes" element={<StudentQuizzes />} />
                  <Route path="payments" element={<StudentPayments />} />
                  <Route path="reports" element={<StudentReports />} />
                  <Route path="notifications" element={<StudentNotifications />} />
                </Route>

                <Route
                  path="/app/professor"
                  element={
                    <RoleGate role="professor">
                      <DashboardLayout role="professor" />
                    </RoleGate>
                  }
                >
                  <Route index element={<ProfessorHome />} />
                  <Route path="courses" element={<ProfessorCourses />} />
                  <Route path="students" element={<ProfessorStudents />} />
                  <Route path="lectures" element={<ProfessorLectures />} />
                  <Route path="quizzes" element={<ProfessorQuizzes />} />
                  <Route path="timetable" element={<ProfessorSchedule />} />
                  <Route path="announcements" element={<ProfessorAnnouncements />} />
                  <Route path="grades" element={<ProfessorGrades />} />
                  <Route path="appeals" element={<ProfessorAppeals />} />
                  <Route path="notifications" element={<ProfessorNotifications />} />
                </Route>

                <Route
                  path="/app/admin"
                  element={
                    <RoleGate role="admin">
                      <DashboardLayout role="admin" />
                    </RoleGate>
                  }
                >
                  <Route index element={<AdminHome />} />
                  <Route path="accounts" element={<AdminAccounts />} />
                  <Route path="access-requests" element={<AdminAccessRequests />} />
                  <Route path="admins" element={<AdminAdmins />} />
                  <Route path="departments" element={<AdminDepartments />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="semesters" element={<AdminSemesters />} />
                  <Route path="rollover" element={<AdminRollover />} />
                  <Route path="schedules" element={<AdminSchedules />} />
                  <Route path="events" element={<AdminEvents />} />
                  <Route path="announcements" element={<AdminAnnouncements />} />
                  <Route path="grades" element={<AdminGrades />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="attendance" element={<AdminAttendance />} />
                  <Route path="appeals" element={<AdminAppeals />} />
                  <Route path="activity" element={<AdminActivity />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>

                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Boot>
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  )
}