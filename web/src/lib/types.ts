export type UserRole = "learner" | "author" | "admin" | "partner" | "finance";

export interface UserAttribution {
  user_id: string;
  org_id: string;
  org_name?: string;
  invite_code?: string;
  bound_at?: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
}

export interface Camp {
  id: string;
  name: string;
  version: string;
  invite_code?: string;
}

export interface AuthMe {
  user: User;
  camp_id: string | null;
  camps: Camp[];
  csrf?: string | null;
  server_time?: number;
  attribution?: UserAttribution | null;
  wx_bound?: boolean;
  needs_wx_bind?: boolean;
  /** Learner still has placeholder name or no avatar */
  profile_incomplete?: boolean;
  /** Server-decided post-login home path */
  default_home?: string;
  /** Server-decided portal switch entries — render only these */
  portals?: AuthPortal[];
}

export interface AuthPortal {
  id: string;
  label: string;
  path: string;
  kind: "learner" | "author" | "partner" | "finance" | string;
  org_id?: string;
}

export type NodeKind = "learn" | "quiz" | "lab" | "project" | "review" | "unlock";
export type NodeStatus = "locked" | "available" | "in_progress" | "passed" | "failed";

export interface CapsuleMedia {
  kind: "video" | "audio";
  title?: string;
  /** MinIO object key under fde-documents (or course-media prefix) */
  object_key: string;
  poster_key?: string;
  duration_sec?: number;
  captions_vtt_key?: string;
  /** Inline transcript for audio screen; lines may start with mm:ss */
  transcript?: string;
  transcript_key?: string;
  /** True when video asset is not uploaded yet (Week 3 etc.) */
  pending?: boolean;
}

export type CapsulePracticeInputType = "text" | "markdown" | "checklist";

/** `practice` accepts a legacy plain string (implicitly required text) or a
 * structured object; `capsuleApi`/`CapsuleReader` normalize both shapes. */
export interface CapsulePracticeSpec {
  prompt: string;
  input_type?: CapsulePracticeInputType;
  required?: boolean;
}

/** Local Codex prep block — copy prompt + checklist before Agent Lab work. */
export interface CapsuleLocalPrep {
  skill_id?: string;
  codex_prompt?: string;
  checklist?: string[];
  template_resource_id?: string;
  suggested_questions?: string[];
}

export interface CapsuleTool {
  name: string;
  note?: string;
  url?: string;
}

/** Interactive concept card for the knowledge-cards learn step. */
export interface KnowledgeCard {
  id: string;
  term: string;
  plain: string;
  detail?: string;
  tag?: string;
}

export interface Capsule {
  id: string;
  title: string;
  minutes?: number;
  content?: string;
  practice?: string | CapsulePracticeSpec;
  local_prep?: CapsuleLocalPrep;
  media?: CapsuleMedia[];
  resource_ids?: string[];
  resources?: DayResource[];
  tools?: CapsuleTool[];
  knowledge_cards?: KnowledgeCard[];
  /** Teacher-authored memory sentence sourced from the lesson narration. */
  memory_sentence?: string;
  /** Section glossary shown left of resources under the video step. */
  glossary_terms?: KnowledgeCard[];
  quiz?: { questions?: Array<{ q: string; options: string[]; answer?: number; explain?: string }>; pass_rate?: number };
  lab?: Record<string, unknown>;
  advanced?: Record<string, unknown>;
}

export interface PracticeResponse {
  id?: string;
  day: number;
  capsule_id: string;
  response_text: string;
  response_json?: Record<string, unknown>;
  status: "draft" | "submitted" | string;
  submitted_at?: string | null;
  updated_at?: string | null;
}

export interface NodeState {
  id: string;
  kind: NodeKind;
  title: string;
  status: NodeStatus;
  refs: Record<string, unknown>;
}

export interface DayNodeSummary {
  id: string;
  title: string;
  kind: NodeKind | string;
  status: NodeStatus | string;
}

export interface DaySummary {
  day: number;
  title: string;
  project?: string | null;
  source: string;
  runner?: string | null;
  passed?: number | null;
  total?: number | null;
  /** Cross-day gate (M6): true when the previous day's nodes aren't all passed yet. */
  locked?: boolean;
  /** Tree L2 — per-day node summary (unlock nodes excluded), populated when authenticated. */
  nodes?: DayNodeSummary[];
  /** Read-only lesson menu; available even while the Day is locked. */
  capsules?: Array<Pick<Capsule, "id" | "title" | "minutes">>;
}

/** Returned by `dayApi.completeNode` — drives auto-advance / auto-next-day in LearnerHome. */
export interface NodeCompleteResult {
  node_id?: string;
  status?: string;
  unlocked?: string | null;
  day_complete?: boolean;
  next_day?: number | null;
  evidence_id?: string | null;
}

export interface DayPackage {
  camp_version: string;
  camp_id: string;
  day: number;
  title: string;
  project?: string | null;
  project_brief?: string | null;
  review_checklist: string[];
  learn: {
    capsules?: Capsule[];
    steps?: string[];
    require_capsules?: boolean;
    estimated_minutes?: number;
    lingzhi_tags?: string[];
  };
  lab: {
    runner?: string;
    sim_kind?: string;
    agent?: { prompt_template?: string };
    rubric?: RubricCheck[];
    seed?: Record<string, unknown>;
    ui?: Record<string, unknown>;
    /** Sim terminal labs: task instructions shown above the terminal and
     * quick-command buttons (fallback is the nginx starter set). */
    task_brief?: string;
    quick_commands?: string[];
    coach?: {
      help_mode?: "explain" | "debug" | "process" | "interview" | "review";
      skill_id?: string;
      max_help_level?: number;
      allow_job_summary?: boolean;
      allow_state_summary?: boolean;
    };
    /** Workspace day-view (A) — `cumulative` keeps prior days' files visible
     * under 「项目历史」while `primary_files` are today's focus under 「本日作业」. */
    workspace_mode?: "cumulative" | "isolated" | string;
    primary_files?: string[];
    inherited_files?: string[];
  };
  quiz: {
    questions?: QuizQuestion[];
    pass_rate?: number;
  };
  nodes: NodeState[];
  source?: string;
  week?: number;
  /** Learner-facing supplementary tools/materials declared in the package YAML. */
  resources?: DayResource[];
}

export interface DayResource {
  id: string;
  title: string;
  kind?: string;
  summary?: string;
  url?: string;
  object_key?: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer?: number;
  explain?: string;
}

export interface RubricCheck {
  check: string;
  args?: Record<string, unknown>;
  /** Explainable eval (M3) — present once the backend enriches a rubric item. */
  title_zh?: string;
  description_zh?: string;
  expectation?: string;
  hint?: string;
  learner_visible?: boolean;
  weight?: number;
}

export interface EvalCheckResult {
  id: string;
  ok: boolean;
  detail: string;
  args?: Record<string, unknown>;
  /** Explainable eval (M3) — present once the backend enriches an eval result. */
  title_zh?: string;
  description_zh?: string;
  expectation?: string;
  suggestion?: string;
}

export interface EvalResult {
  pass: boolean;
  checks: EvalCheckResult[];
  score: number;
  weighted_score?: number;
}

export interface LearningDailySummary {
  learner_id: string;
  camp_id: string;
  day: number;
  week: number;
  passed: number;
  total: number;
  progress_pct: number;
  study_seconds: number;
}

export interface Passport {
  learner_id: string;
  cert_id: string;
  disclaimer: string;
  capability_tags: string[];
  evidence_count: number;
  tracks: { sim: boolean; agent: boolean };
}

export interface AgentJob {
  job_id?: string;
  id?: string;
  status: string;
  runner?: string;
  result?: { files?: string[]; primary?: string; snapshot_id?: string };
  events?: AgentEvent[];
}

export interface AgentEvent {
  id?: number;
  type: string;
  message?: string;
  payload?: Record<string, unknown>;
  ts?: string;
}

export interface WorkspaceFile {
  path: string;
  size: number;
  /** Present when `agentApi.listFiles` is called with a `day` — tags each
   * file as today's focus, inherited from a prior day, or unrelated. */
  bucket?: "primary" | "inherited" | "other";
  kind?: "text" | "binary" | string;
  editable?: boolean;
  language?: string;
  mime?: string;
}

export interface WorkspaceEntry extends WorkspaceFile {
  status?: "ok" | "binary" | "too_large" | string;
  content?: string;
}

export interface IdeDiagnostic {
  path: string;
  message: string;
  severity: string;
}

export interface AuthorDocumentBinding {
  id?: string;
  day: number;
  capsule_id?: string | null;
  course_version_id?: string | null;
}

export interface AuthorDocument {
  id: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  object_key?: string | null;
  status: string;
  camp_id?: string;
  created_at?: string;
  error_message?: string;
  /** Preferred: bindings returned by GET /author/documents */
  bindings?: AuthorDocumentBinding[];
  /** Legacy aliases — prefer bindings */
  day?: number | null;
  bound_day?: number | null;
}

export interface CourseVersion {
  id: string;
  camp_id: string;
  version_tag: string;
  status: string;
  title: string;
  published_at?: string | null;
  created_at?: string;
}

export interface AuthorCourse {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  created_at?: string;
  version_count?: number;
}

export interface AuthorCourseVersion {
  id: string;
  camp_id?: string | null;
  course_id?: string | null;
  version_tag: string;
  status: string;
  title: string;
  source?: string | null;
  published_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  day_count?: number;
}

export interface LabCompleteResult {
  submission_id: string;
  evidence_id: string;
  node_id: string;
  status: string;
  unlocked: string | null;
  eval_result?: EvalResult;
  learner_id?: string;
  camp_id?: string;
}

export interface LandingHeroVideo {
  poster_url?: string | null;
  src_url?: string | null;
  captions_url?: string | null;
}

export interface LandingTab {
  id: string;
  label: string;
}

export interface LandingMentor {
  id?: string;
  name?: string;
  title?: string;
  avatar_url?: string | null;
  avatar_key?: string | null;
  bio?: string;
}

export interface LandingFact {
  n?: string;
  t?: string;
  d?: string;
}

export interface LandingEnterprise {
  title: string;
  subtitle: string;
  mentors: LandingMentor[];
  facts?: LandingFact[];
}

export interface LandingBrand {
  name?: string;
  footer?: string;
}

export interface LandingHeroProof {
  value?: string;
  label?: string;
}

export interface LandingHeroCopy {
  eyebrow?: string;
  empty_title?: string;
  title_lines?: string[];
  title_em?: string;
  cta_primary?: string;
  cta_secondary?: string;
  bg_image?: string;
  proof?: LandingHeroProof[];
}

export interface LandingSeo {
  title?: string;
  description?: string;
  keywords?: string;
  og_image?: string;
}

export interface LandingOpenCourseCategory {
  id: string;
  name: string;
  sort_order?: number;
  published?: boolean;
}

export interface LandingOpenCourse {
  id: string;
  title: string;
  minutes?: number;
  level?: string;
  category_id?: string | null;
  summary?: string;
  object_key?: string | null;
  poster_key?: string | null;
  duration_sec?: number | null;
  published?: boolean;
  stream_url?: string | null;
  poster_url?: string | null;
}

export interface LandingAbout {
  title: string;
  body: string;
  story?: string[];
  pillars?: { n: string; title: string; desc: string }[];
  partners_title?: string;
  partners_lead?: string;
}

export interface LandingContact {
  title: string;
  subtitle?: string;
  email?: string;
  note?: string;
}

export interface LandingHomeHeroTrust {
  num: string;
  unit: string;
  label: string;
}

export interface LandingHomeHero {
  eyebrow?: string;
  title_lead?: string;
  title_em?: string;
  title_line2?: string;
  pillars?: string[];
  sub?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  trust?: LandingHomeHeroTrust[];
}

export interface LandingHomePainItem {
  idx: string;
  title: string;
  body: string;
}

export interface LandingHomeFeatureItem {
  no: string;
  title: string;
  body: string;
}

export interface LandingHomeSyllabusDay {
  d: string;
  t: string;
  s: string;
  out: string[];
}

export interface LandingHomeSyllabusWeek {
  week: string;
  title: string;
  summary: string;
  status: string;
  days?: LandingHomeSyllabusDay[];
  comingNotes?: string[];
}

export interface LandingHomeRole {
  token: string;
  title: string;
  desc: string;
}

export interface LandingHomeWork {
  tag: string;
  title: string;
  body: string;
  who: string;
  badge: string;
  fill?: string;
  path?: string;
  sun?: string;
}

export interface LandingHomeVoice {
  quote: string;
  name: string;
  meta: string;
  avatarBg?: string;
}

export interface LandingHomeFaqItem {
  q: string;
  a: string;
}

export interface LandingHomeContent {
  hero?: LandingHomeHero;
  pain?: {
    tag?: string;
    title_html?: string;
    title_lines?: string[];
    subtitle?: string;
    items?: LandingHomePainItem[];
    turn?: string;
  };
  features?: {
    tag?: string;
    title_before?: string;
    title_accent?: string;
    items?: LandingHomeFeatureItem[];
    meta?: string[];
  };
  outline?: {
    tag?: string;
    title?: string;
    subtitle?: string;
    weeks?: LandingHomeSyllabusWeek[];
  };
  method?: {
    tag?: string;
    title_line1?: string;
    title_line2?: string;
    subtitle?: string;
    roles?: LandingHomeRole[];
  };
  works?: {
    tag?: string;
    title?: string;
    subtitle?: string;
    items?: LandingHomeWork[];
  };
  voices?: {
    tag?: string;
    title?: string;
    items?: LandingHomeVoice[];
  };
  pricing?: {
    tag?: string;
    title?: string;
    subtitle?: string;
    perks?: string[];
    price_label?: string;
    price_amount?: string;
    price_unit?: string;
    price_note?: string;
  };
  faq?: {
    tag?: string;
    title?: string;
    items?: LandingHomeFaqItem[];
  };
  final_cta?: {
    title?: string;
    body?: string;
    secondary_cta?: string;
  };
}

export interface LandingFooterContent {
  blurb?: string;
  company?: string;
  email?: string;
  office?: string;
  tagline?: string;
}

export interface LandingPartner {
  id: string;
  name: string;
  tag: string;
  logo: string;
  logoAlt: string;
}

export interface LandingSeoByRoute {
  home?: LandingSeo;
  enterprise?: LandingSeo;
  about?: LandingSeo;
  open?: LandingSeo;
  [route: string]: LandingSeo | undefined;
}

export interface LandingPayload {
  title: string;
  tagline: string;
  hero_video: LandingHeroVideo | null;
  cta: { login: string; app: string };
  brand?: LandingBrand;
  hero?: LandingHeroCopy;
  seo?: LandingSeo;
  home?: LandingHomeContent;
  footer?: LandingFooterContent;
  partners?: LandingPartner[];
  seo_by_route?: LandingSeoByRoute;
  tabs?: LandingTab[];
  enterprise?: LandingEnterprise;
  open_course_categories?: LandingOpenCourseCategory[];
  open_courses?: LandingOpenCourse[];
  about?: LandingAbout;
  contact?: LandingContact;
}

export interface ContactLeadBody {
  name: string;
  org?: string;
  email?: string;
  message?: string;
}

export type IdentityStatus = "unverified" | "pending" | "verified" | "rejected";

export interface LearnerProfile {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  identity_status: IdentityStatus | string;
  identity_masked_name?: string | null;
  identity_id_tail?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  wx_nickname?: string | null;
  profile_incomplete?: boolean;
  needs_display_name?: boolean;
  needs_avatar?: boolean;
  camps: Camp[];
}

export interface EnrollmentRecord {
  enrollment_id: string;
  status: string;
  created_at?: string;
  offering_id?: string;
  offering_title?: string;
  camp_id?: string;
  course_version_id?: string;
  course_id?: string;
  course_title?: string;
}

export interface CertificateItem {
  id: string;
  cert_id: string | null;
  camp_id?: string;
  course_title?: string;
  status: string;
  issued_at?: string | null;
  legacy?: boolean;
  on_chain?: boolean;
  chain_tx_hash?: string | null;
  chain_network?: string | null;
}

export interface IdentityStartResult {
  provider: string;
  verification_id: string;
  status: string;
  masked_name?: string | null;
  id_tail?: string | null;
}

export interface ChainPublicInfo {
  holder_name?: string | null;
  course_title?: string | null;
  issued_at?: string | null;
  id_number_sha256?: string | null;
  id_hash_algorithm?: string | null;
  id_hash_normalization?: string | null;
  id_hash_steps?: string[];
  tx_hash?: string | null;
  block_height?: number | null;
  field_checks?: {
    course_consistent?: boolean;
    issued_at_consistent?: boolean;
  };
}

export interface CertificateVerifyResult {
  valid: boolean;
  verified_identity?: boolean;
  identity_verified?: boolean;
  id?: string;
  cert_id?: string;
  course_title?: string;
  status?: string;
  issued_at?: string | null;
  learner_name?: string | null;
  message?: string;
  on_chain?: boolean;
  chain_tx_hash?: string | null;
  chain_network?: string | null;
  chain_content_hash?: string | null;
  chain_anchor_at?: string | null;
  chain_block_height?: number | null;
  chain_block_hash?: string | null;
  chain_holder_name?: string | null;
  chain_id_number_sha256?: string | null;
  chain_public?: ChainPublicInfo | null;
  chain_only?: boolean;
  platform_record?: boolean;
  requires_identity_challenge?: boolean;
}

export interface CertificateVerifyBody {
  cert_id: string;
  real_name: string;
  id_tail: string;
}

export interface Submission {
  id: string;
  camp_id: string;
  learner_id: string;
  day: number;
  node_id: string;
  status: string;
  feedback?: string | null;
  score?: number | null;
  created_at?: string;
  eval_json?: Record<string, unknown>;
}

/** M5 — AI coach loop: structured, LLM-free diagnosis derived from rubric/quiz
 * failures, returned alongside every coach reply and by `/api/v1/coach/diagnose`. */
export interface CoachDiagnostics {
  mode?: "offline" | string;
  diagnosis_zh?: string;
  error_tags?: string[];
  next_action?: "retry_lab" | "reread_capsule" | "ask_mentor" | "continue" | string;
  next_action_zh?: string;
  next_node_hint?: string | null;
  fail_count?: number;
  reproducible?: {
    model?: string;
    prompt_version?: string;
    citation_ids?: (string | undefined)[];
  };
}

export interface MentorReview {
  id: string;
  learner_id: string;
  camp_id?: string | null;
  enrollment_id?: string | null;
  day?: number | null;
  node_id?: string | null;
  submission_id?: string | null;
  coach_turn_id?: string | null;
  reason?: string;
  diagnostics_json?: CoachDiagnostics;
  status: "pending" | "resolved" | string;
  mentor_id?: string | null;
  mentor_feedback?: string | null;
  mentor_score?: number | null;
  created_at?: string;
  resolved_at?: string | null;
}
