import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import DashboardLayout, { RoleGate } from './layout/DashboardLayout'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { Loader, ToastProvider } from './lib/ui'
import Login from './pages/Login'
import {
  StudentCatalog, StudentCourseDetail, StudentCourses, StudentHome, StudentNotifications, StudentReports, StudentSchedule,
} from './pages/student'
import {
  ProfessorCourses, ProfessorGrades, ProfessorHome, ProfessorLectures, ProfessorNotifications, ProfessorQuizzes, ProfessorStudents,
} from './pages/professor'
import {
  AdminAccounts, AdminAccessRequests, AdminAdmins, AdminCourses, AdminDepartments, AdminEvents, AdminGrades, AdminHome, AdminSchedules, AdminSemesters,
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
                  <Route path="grades" element={<ProfessorGrades />} />
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
                  <Route path="schedules" element={<AdminSchedules />} />
                  <Route path="events" element={<AdminEvents />} />
                  <Route path="grades" element={<AdminGrades />} />
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