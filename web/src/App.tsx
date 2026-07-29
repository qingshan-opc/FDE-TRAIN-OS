import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Skeleton } from "./components/Skeleton";
import { ScrollToTop } from "./components/ScrollToTop";
import { Landing } from "./app/Landing";
import { OpenCoursesPage } from "./app/OpenCoursesPage";
import { DocReaderPage } from "./app/DocReaderPage";
import { AboutPage } from "./app/AboutPage";
import { LoginPage } from "./app/Login";
import { LearnerHome } from "./app/LearnerHome";
import { CoursePicker } from "./app/CoursePicker";
import { Profile } from "./app/Profile";
import { Certificates } from "./app/Certificates";
import { Identity } from "./app/Identity";
import { VerifyCertificate } from "./app/VerifyCertificate";
import { ChainExplorer } from "./app/ChainExplorer";
import { AuthorHome } from "./author/AuthorHome";
import { AuthorOverview } from "./author/AuthorOverview";
import { DocumentLibrary } from "./author/DocumentLibrary";
import { AuthorCourses } from "./author/AuthorCourses";
import { CurriculumWorkbench } from "./author/curriculum/CurriculumWorkbench";
import { CampKeySettings } from "./author/CampKeySettings";
import { SiteSettings } from "./author/site/SiteSettings";
import { SiteHome } from "./author/site/SiteHome";
import { SiteOpenCourses } from "./author/site/SiteOpenCourses";
import { SiteEnterprise } from "./author/site/SiteEnterprise";
import { SiteLeads } from "./author/site/SiteLeads";
import { VideoLibrary } from "./author/resources/VideoLibrary";
import { MaterialPacks } from "./author/resources/MaterialPacks";
import { LearnerCourses } from "./author/learners/LearnerCourses";
import { LearnerSubmissions } from "./author/learners/LearnerSubmissions";
import { LearnerReviews } from "./author/learners/LearnerReviews";
import { LearnerEnrollmentDetail } from "./author/learners/LearnerEnrollmentDetail";
import { CourseVersions } from "./author/curriculum/CourseVersions";
import { MaterialPackDetail } from "./author/resources/MaterialPackDetail";
import { ChannelSettings } from "./author/settings/ChannelSettings";
import { CourseShop } from "./app/CourseShop";
import { PartnerLoginPage } from "./partner/PartnerLogin";
import { PartnerHome } from "./partner/PartnerHome";
import { PartnerDashboard, PartnerShares } from "./partner/PartnerDashboard";

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Array<"learner" | "author" | "admin" | "partner"> }) {
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
      <Route path="/docs/*" element={<DocReaderPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/partner/login" element={<PartnerLoginPage />} />
      <Route path="/verify" element={<VerifyCertificate />} />
      <Route path="/verify/:certId" element={<VerifyCertificate />} />
      <Route path="/chain" element={<ChainExplorer />} />
      <Route path="/chain/algorithms" element={<ChainExplorer />} />
      <Route path="/chain/block/:height" element={<ChainExplorer />} />
      <Route path="/chain/tx/:txHash" element={<ChainExplorer />} />
      <Route path="/chain/cert/:certId" element={<ChainExplorer />} />
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
        path="/app/shop"
        element={
          <RequireAuth roles={["learner"]}>
            <CourseShop />
          </RequireAuth>
        }
      />
      <Route
        path="/partner"
        element={
          <RequireAuth roles={["partner", "admin"]}>
            <PartnerHome />
          </RequireAuth>
        }
      >
        <Route index element={<PartnerDashboard />} />
        <Route path="shares" element={<PartnerShares />} />
      </Route>
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
        <Route path="resources/packs/:packId" element={<MaterialPackDetail />} />
        <Route path="curriculum/courses" element={<AuthorCourses />} />
        <Route path="curriculum/versions" element={<CourseVersions />} />
        <Route path="curriculum/courses/:courseId/versions/:versionId" element={<CurriculumWorkbench />} />
        <Route path="learners/submissions" element={<LearnerSubmissions />} />
        <Route path="learners/reviews" element={<LearnerReviews />} />
        <Route path="learners/:enrollmentId" element={<LearnerEnrollmentDetail />} />
        <Route path="learners" element={<LearnerCourses />} />
        <Route path="settings/camp-key" element={<CampKeySettings />} />
        <Route path="settings/channels" element={<ChannelSettings />} />

        {/* Legacy redirects */}
        <Route path="documents" element={<Navigate to="/author/resources/documents" replace />} />
        <Route path="open-courses" element={<Navigate to="/author/site/open-courses" replace />} />
        <Route path="course" element={<Navigate to="/author/curriculum/versions" replace />} />
        <Route path="courses" element={<Navigate to="/author/curriculum/courses" replace />} />
        <Route path="courses/:courseId/versions/:versionId" element={<CurriculumWorkbench />} />
        <Route path="submissions" element={<Navigate to="/author/learners/submissions" replace />} />
        <Route path="legacy/submissions" element={<Navigate to="/author/learners/reviews" replace />} />
        <Route path="legacy/course-editor" element={<Navigate to="/author/curriculum/versions" replace />} />
        <Route path="legacy/open-courses" element={<Navigate to="/author/site/open-courses" replace />} />
        <Route path="keys" element={<Navigate to="/author/settings/camp-key" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
