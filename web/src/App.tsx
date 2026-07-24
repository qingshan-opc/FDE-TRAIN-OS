import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Skeleton } from "./components/Skeleton";
import { ScrollToTop } from "./components/ScrollToTop";
import { Landing } from "./app/Landing";
import { OpenCoursesPage } from "./app/OpenCoursesPage";
import { AboutPage } from "./app/AboutPage";
import { LoginPage } from "./app/Login";
import { LearnerHome } from "./app/LearnerHome";
import { CoursePicker } from "./app/CoursePicker";
import { Profile } from "./app/Profile";
import { Certificates } from "./app/Certificates";
import { Identity } from "./app/Identity";
import { VerifyCertificate } from "./app/VerifyCertificate";
import { AuthorHome } from "./author/AuthorHome";
import { AuthorOverview } from "./author/AuthorOverview";
import { DocumentLibrary } from "./author/DocumentLibrary";
import { CourseEditor } from "./author/CourseEditor";
import { AuthorCourses } from "./author/AuthorCourses";
import { CurriculumWorkbench } from "./author/curriculum/CurriculumWorkbench";
import { Submissions } from "./author/Submissions";
import { CampKeySettings } from "./author/CampKeySettings";
import { AuthorOpenCourses } from "./author/AuthorOpenCourses";
import { SiteSettings } from "./author/site/SiteSettings";
import { SiteHome } from "./author/site/SiteHome";
import { SiteOpenCourses } from "./author/site/SiteOpenCourses";
import { SiteEnterprise } from "./author/site/SiteEnterprise";
import { SiteLeads } from "./author/site/SiteLeads";
import { VideoLibrary } from "./author/resources/VideoLibrary";
import { MaterialPacks } from "./author/resources/MaterialPacks";
import { LearnerCourses } from "./author/learners/LearnerCourses";
import { LearnerSubmissions } from "./author/learners/LearnerSubmissions";
import { CourseVersions } from "./author/curriculum/CourseVersions";

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Array<"learner" | "author" | "admin"> }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton rows={6} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to={user.role === "author" ? "/author" : "/app"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/open" element={<OpenCoursesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyCertificate />} />
      <Route path="/verify/:certId" element={<VerifyCertificate />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <LearnerHome />
          </RequireAuth>
        }
      />
      <Route
        path="/app/day/:day"
        element={
          <RequireAuth>
            <LearnerHome />
          </RequireAuth>
        }
      />
      <Route
        path="/app/courses"
        element={
          <RequireAuth>
            <CoursePicker />
          </RequireAuth>
        }
      />
      <Route
        path="/app/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/app/certificates"
        element={
          <RequireAuth>
            <Certificates />
          </RequireAuth>
        }
      />
      <Route
        path="/app/identity"
        element={
          <RequireAuth>
            <Identity />
          </RequireAuth>
        }
      />
      <Route
        path="/author"
        element={
          <RequireAuth roles={["author", "admin"]}>
            <AuthorHome />
          </RequireAuth>
        }
      >
        <Route index element={<AuthorOverview />} />
        <Route path="site/settings" element={<SiteSettings />} />
        <Route path="site/home" element={<SiteHome />} />
        <Route path="site/open-courses" element={<SiteOpenCourses />} />
        <Route path="site/enterprise" element={<SiteEnterprise />} />
        <Route path="site/leads" element={<SiteLeads />} />
        <Route path="resources/documents" element={<DocumentLibrary />} />
        <Route path="resources/videos" element={<VideoLibrary />} />
        <Route path="resources/packs" element={<MaterialPacks />} />
        <Route path="curriculum/courses" element={<AuthorCourses />} />
        <Route path="curriculum/versions" element={<CourseVersions />} />
        <Route path="curriculum/courses/:courseId/versions/:versionId" element={<CurriculumWorkbench />} />
        <Route path="learners" element={<LearnerCourses />} />
        <Route path="learners/submissions" element={<LearnerSubmissions />} />
        <Route path="settings/camp-key" element={<CampKeySettings />} />

        {/* Legacy redirects */}
        <Route path="documents" element={<Navigate to="/author/resources/documents" replace />} />
        <Route path="open-courses" element={<Navigate to="/author/site/open-courses" replace />} />
        <Route path="course" element={<Navigate to="/author/curriculum/versions" replace />} />
        <Route path="courses" element={<Navigate to="/author/curriculum/courses" replace />} />
        <Route path="courses/:courseId/versions/:versionId" element={<CurriculumWorkbench />} />
        <Route path="submissions" element={<Navigate to="/author/learners/submissions" replace />} />
        <Route path="keys" element={<Navigate to="/author/settings/camp-key" replace />} />

        {/* Keep legacy components reachable if needed during migration */}
        <Route path="legacy/course-editor" element={<CourseEditor />} />
        <Route path="legacy/open-courses" element={<AuthorOpenCourses />} />
        <Route path="legacy/submissions" element={<Submissions />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
