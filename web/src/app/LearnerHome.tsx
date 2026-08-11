import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { dayApi, learningApi, practiceApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Nav } from "../components/Nav";
import { CoachFloatingDock } from "../components/coach/CoachFloatingDock";
import { LearnerSessionProvider } from "../lib/learnerSessionContext";
import { SyllabusRail } from "../components/SyllabusRail";
import { TaskRail } from "../components/TaskRail";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { DayView } from "./DayView";
import { WeekQuiz } from "./WeekQuiz";
import { WeekCockpitHomework } from "./WeekCockpitHomework";
import { PassportView } from "./Passport";
import type { Capsule, DayNodeSummary, DayPackage, DaySummary, NodeCompleteResult } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import { dayTaskPath, primaryCtaLabel, resolveNextTarget, resolveTargetForDay } from "../lib/taskTargets";
import { CourseIntro } from "./CourseIntro";
import { parseWeekQuizNodeId, weekQuizNodeId, parseWeekCockpitHomeworkNodeId, weekCockpitHomeworkNodeId } from "../components/Tree";

type MobileTab = "course" | "content" | "task";

const DEFAULT_WEEKS: Record<string, number[]> = {
  "1": [1, 2, 3, 4, 5, 6],
  "2": [7, 8, 9, 10, 11],
  "3": [12, 13, 14, 15, 16, 17],
};

const LEARNER_DAY_KINDS = new Set(["learn", "lab"]);


export function LearnerHome() {
  const { day: dayParam } = useParams();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { campId, loading: authLoading } = useAuth();
  const [days, setDays] = useState<DaySummary[]>([]);
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  const [dayPkg, setDayPkg] = useState<DayPackage | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("content");
  const [showPassport, setShowPassport] = useState(false);
  const [openCapsuleId, setOpenCapsuleId] = useState<string | null>(null);
  const [readCapsuleIds, setReadCapsuleIds] = useState<Set<string>>(() => new Set());
  const pendingCapsuleRef = useRef<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [studySeconds, setStudySeconds] = useState(0);
  const [week1CockpitHomeworkDone, setWeek1CockpitHomeworkDone] = useState(false);

  const activeDay = dayParam ? Number(dayParam) : null;
  const nodeParam = searchParams.get("node");

  const loadDays = useCallback(async () => {
    if (!campId) return;
    setListLoading(true);
    setError(null);
    try {
      const res = await dayApi.list(campId);
      setDays(res.days || []);
      setWeeks(res.weeks || DEFAULT_WEEKS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "课程列表加载失败");
    } finally {
      setListLoading(false);
    }
  }, [campId]);

  const focusNode = useCallback(
    (id: string | null) => {
      setActiveNodeId(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("node", id);
          else next.delete("node");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Reset capsule TOC selection when the focused Day/node changes — keep a
  // pending id when the learner clicked a capsule that triggered navigation.
  useEffect(() => {
    if (pendingCapsuleRef.current) {
      setOpenCapsuleId(pendingCapsuleRef.current);
      pendingCapsuleRef.current = null;
    } else {
      setOpenCapsuleId(null);
    }
    setReadCapsuleIds(new Set());
  }, [activeDay, activeNodeId]);

  const loadDay = useCallback(
    async (day: number, preferNodeId?: string | null) => {
      if (!campId) return;
      setDayLoading(true);
      setError(null);
      setShowPassport(false);
      try {
        const pkg = await dayApi.get(campId, day);
        setDayPkg(pkg);
        // Keep week-quiz / week-homework deep links; otherwise prefer learn over hidden quiz/project.
        if (
          preferNodeId &&
          (parseWeekQuizNodeId(preferNodeId) != null || parseWeekCockpitHomeworkNodeId(preferNodeId) != null)
        ) {
          focusNode(preferNodeId);
        } else {
          const prefer =
            (preferNodeId &&
              LEARNER_DAY_KINDS.has(
                String(pkg.nodes.find((n) => n.id === preferNodeId)?.kind || ""),
              ) &&
              pkg.nodes.find((n) => n.id === preferNodeId)) ||
            pkg.nodes.find((n) => n.kind === "learn") ||
            pkg.nodes.find((n) => LEARNER_DAY_KINDS.has(String(n.kind)) && n.status === "available") ||
            pkg.nodes.find((n) => LEARNER_DAY_KINDS.has(String(n.kind)) && n.status !== "locked") ||
            pkg.nodes.find((n) => n.kind === "learn") ||
            null;
          focusNode(prefer?.id ?? null);
        }
        setMobileTab("content");
      } catch (err) {
        setDayPkg(null);
        setError(err instanceof ApiError ? err.message : "Day 包加载失败");
      } finally {
        setDayLoading(false);
      }
    },
    [campId, focusNode],
  );

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    if (activeDay && campId) void loadDay(activeDay, nodeParam);
    if (!activeDay) {
      setDayPkg(null);
      setActiveNodeId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, campId, loadDay]);

  const dayStatuses = useMemo(() => {
    const map: Record<number, { passed: number; total: number; runner?: string | null; nodes?: DayNodeSummary[] }> = {};
    for (const d of days) {
      const visible = (d.nodes || []).filter((n) => LEARNER_DAY_KINDS.has(String(n.kind)));
      const passed = visible.length
        ? visible.filter((n) => n.status === "passed").length
        : d.passed ?? 0;
      const total = visible.length || Math.max(1, Math.min(d.total ?? 1, 2));
      map[d.day] = {
        passed,
        total,
        runner: d.runner,
        nodes: d.nodes,
      };
    }
    if (dayPkg) {
      const visible = dayPkg.nodes.filter((n) => LEARNER_DAY_KINDS.has(String(n.kind)));
      map[dayPkg.day] = {
        passed: visible.filter((n) => n.status === "passed").length,
        total: visible.length || 1,
        runner: dayPkg.lab?.runner,
        nodes: dayPkg.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind, status: n.status })),
      };
    }
    return map;
  }, [days, dayPkg]);

  const weekQuizWeek = parseWeekQuizNodeId(activeNodeId);
  const weekCockpitHwWeek = parseWeekCockpitHomeworkNodeId(activeNodeId);
  const activeNode =
    weekQuizWeek != null || weekCockpitHwWeek != null
      ? null
      : dayPkg?.nodes.find((n) => n.id === activeNodeId) || null;
  const labNode = dayPkg?.nodes.find((n) => n.kind === "lab") || null;

  const learnCapsules: Capsule[] = useMemo(() => {
    if (!dayPkg) return [];
    // Capsules stay available in the left rail whenever the day is open (incl. week quiz).
    const learn = dayPkg.nodes.find((n) => n.kind === "learn");
    const fromRefs = (learn?.refs?.capsules as Capsule[]) || [];
    const fromLearn = dayPkg.learn?.capsules || [];
    return (fromRefs.length ? fromRefs : fromLearn).map((c, i) => ({
      ...c,
      id: c.id || `c${i + 1}`,
    }));
  }, [dayPkg]);

  const navigateToTarget = useCallback(
    (target: ReturnType<typeof resolveNextTarget>) => {
      if (!target) {
        toast.push("暂无课程 Day，请稍后再试", "error");
        return;
      }
      nav(dayTaskPath(target.day, target.nodeId));
      setShowPassport(false);
      setMobileTab("content");
    },
    [nav, toast],
  );

  const goToHomework = useCallback(() => {
    const target = resolveNextTarget(days, { dayPkg });
    if (!target) {
      toast.push("暂无课程 Day，请稍后再试", "error");
      return;
    }
    if (dayPkg && target.day === dayPkg.day) {
      const node = dayPkg.nodes.find((n) => n.id === target.nodeId);
      if (node?.status === "locked") {
        toast.push(
          node.kind === "lab" ? "先完成学习与测验后再做 Lab" : "请先完成前置节点",
          "error",
        );
        return;
      }
      focusNode(target.nodeId);
      setShowPassport(false);
      setMobileTab("content");
      return;
    }
    navigateToTarget(target);
  }, [dayPkg, days, toast, focusNode, navigateToTarget]);

  const homeNextTarget = useMemo(() => resolveNextTarget(days), [days]);
  const displayDay = activeDay ?? homeNextTarget?.day ?? null;

  const displayWeek = useMemo(() => {
    if (!displayDay) return 1;
    for (const [w, ds] of Object.entries(weeks)) {
      if (ds.includes(displayDay)) return Number(w);
    }
    return dayPkg?.week ?? 1;
  }, [displayDay, weeks, dayPkg?.week]);

  const displayProgress = useMemo(() => {
    if (!displayDay) return { pct: 0, passed: 0, total: 0 };
    const st = dayStatuses[displayDay];
    if (!st || st.total <= 0) return { pct: 0, passed: 0, total: 0 };
    return {
      pct: Math.min(100, Math.round((st.passed * 100) / st.total)),
      passed: st.passed,
      total: st.total,
    };
  }, [displayDay, dayStatuses]);

  useEffect(() => {
    if (!campId || !displayDay) return;
    let cancelled = false;
    void learningApi
      .dailySummary({ camp_id: campId, day: displayDay })
      .then((res) => {
        if (!cancelled) setStudySeconds(res.study_seconds);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campId, displayDay]);

  useEffect(() => {
    if (!campId || !displayDay) return;
    const HEARTBEAT_SEC = 30;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      void learningApi
        .heartbeat({ camp_id: campId, day: displayDay, delta_seconds: HEARTBEAT_SEC })
        .then((res) => setStudySeconds(res.study_seconds))
        .catch(() => {});
    };
    const id = window.setInterval(send, HEARTBEAT_SEC * 1000);
    return () => window.clearInterval(id);
  }, [campId, displayDay]);

  const activeCapsule = useMemo(() => {
    if (!learnCapsules.length) return null;
    if (openCapsuleId) return learnCapsules.find((c) => c.id === openCapsuleId) || learnCapsules[0];
    return learnCapsules[0];
  }, [learnCapsules, openCapsuleId]);

  const sessionValue = useMemo(
    () => ({
      displayDay,
      week: displayWeek,
      progressPct: displayProgress.pct,
      studyMinutes: Math.max(0, Math.round(studySeconds / 60)),
      dayPkg,
      activeNode,
      learnCapsules,
      openCapsuleId,
      activeCapsule,
      coachOpen,
      setCoachOpen,
    }),
    [
      displayDay,
      displayWeek,
      displayProgress.pct,
      studySeconds,
      dayPkg,
      activeNode,
      learnCapsules,
      openCapsuleId,
      activeCapsule,
      coachOpen,
    ],
  );

  const handleSelectNode = useCallback(
    (day: number, id: string) => {
      if (day !== activeDay) {
        nav(`/app/day/${day}?node=${encodeURIComponent(id)}`);
        return;
      }
      const n = dayPkg?.nodes.find((x) => x.id === id);
      if (n?.status === "locked") {
        toast.push(
          n.kind === "lab" ? "先完成学习与测验后再做 Lab" : "请先完成前置节点",
          "error",
        );
      }
      focusNode(id);
      setMobileTab("content");
    },
    [activeDay, dayPkg, toast, focusNode, nav],
  );

  const handleNodeCompleted = useCallback(
    (result?: NodeCompleteResult) => {
      if (result?.day_complete && result?.next_day) {
        toast.push(`本日课程已完成，进入${dayLabel(result.next_day)}`, "success");
        const target =
          resolveTargetForDay(days, result.next_day) ?? {
            day: result.next_day,
            nodeId: `d${result.next_day}-learn`,
          };
        nav(dayTaskPath(target.day, target.nodeId));
      } else if (activeDay) {
        void loadDay(activeDay, result?.unlocked ?? activeNodeId);
      }
      void loadDays();
    },
    [activeDay, activeNodeId, days, loadDay, loadDays, nav, toast],
  );

  const handleSelectDay = useCallback(
    (day: number) => {
      const target = resolveTargetForDay(days, day);
      if (!target) {
        toast.push(`请先完成${dayLabel(day - 1)}`, "error");
        return;
      }
      nav(dayTaskPath(target.day, target.nodeId));
      setShowPassport(false);
      setMobileTab("content");
    },
    [days, nav, toast],
  );

  const handleSelectWeekQuiz = useCallback(
    (week: number, anchorDay: number) => {
      const id = weekQuizNodeId(week);
      if (activeDay === anchorDay) {
        focusNode(id);
      } else {
        nav(dayTaskPath(anchorDay, id));
      }
      setShowPassport(false);
      setMobileTab("content");
    },
    [activeDay, focusNode, nav],
  );

  const week1AnchorDay = useMemo(() => {
    const nums = weeks["1"] || DEFAULT_WEEKS["1"];
    return nums[nums.length - 1] || 6;
  }, [weeks]);

  const refreshWeek1CockpitHomework = useCallback(async () => {
    if (!campId) return;
    try {
      const res = await practiceApi.list({ camp_id: campId, day: week1AnchorDay });
      const row = res.items.find((it) => it.capsule_id === "week1-cockpit-hw");
      setWeek1CockpitHomeworkDone(row?.status === "submitted");
    } catch {
      /* optional */
    }
  }, [campId, week1AnchorDay]);

  useEffect(() => {
    void refreshWeek1CockpitHomework();
  }, [refreshWeek1CockpitHomework]);

  const handleSelectWeekCockpitHomework = useCallback(
    (week: number, anchorDay: number) => {
      const id = weekCockpitHomeworkNodeId(week);
      // Prefer anchoring on the last day of week 1 so practice persists with Saturday.
      const day = week === 1 ? week1AnchorDay : anchorDay;
      if (activeDay === day) {
        focusNode(id);
      } else {
        nav(dayTaskPath(day, id));
      }
      setShowPassport(false);
      setMobileTab("content");
    },
    [activeDay, focusNode, nav, week1AnchorDay],
  );

  // Learn mode: right-rail CTA points to homework / next task (complete stays in center).
  const primary = useMemo(() => {
    if (!activeNode) {
      return {
        label: primaryCtaLabel(homeNextTarget),
        disabled: !homeNextTarget,
        action: "homework" as const,
      };
    }
    if (activeNode.kind === "learn") {
      if (labNode && labNode.status !== "passed") {
        return {
          label: "去做作业",
          disabled: labNode.status === "locked",
          action: "lab" as const,
        };
      }
      const next =
        dayPkg?.nodes.find((n) => n.status === "available" && n.id !== activeNode.id) ||
        dayPkg?.nodes.find((n) => n.status !== "locked" && n.status !== "passed" && n.id !== activeNode.id);
      if (next) {
        return { label: `继续：${next.title}`, disabled: false, action: "content" as const };
      }
      return { label: "已完成", disabled: true, action: "noop" as const };
    }
    if (activeNode.status === "passed" && activeNode.kind !== "lab") {
      if (labNode && labNode.status !== "passed") {
        return {
          label: "去做作业",
          disabled: labNode.status === "locked",
          action: "lab" as const,
        };
      }
      return { label: "已完成", disabled: true, action: "noop" as const };
    }
    if (activeNode.status === "locked") {
      return { label: "先完成前置", disabled: true, action: "noop" as const };
    }
    if (activeNode.kind === "lab") {
      return { label: "去做作业", disabled: false, action: "lab" as const };
    }
    if (activeNode.kind === "quiz") return { label: "提交测验", disabled: false, action: "content" as const };
    return { label: "标记完成", disabled: false, action: "content" as const };
  }, [activeNode, labNode, dayPkg, homeNextTarget]);

  if (authLoading || !campId) {
    return (
      <div className="app-shell">
        <Nav />
        <div style={{ padding: 24 }}>
          <Skeleton rows={8} />
        </div>
      </div>
    );
  }

  const workspaceClass = ["workspace", `tab-${mobileTab}`].join(" ");
  const isLabActive = activeNode?.kind === "lab";

  return (
    <LearnerSessionProvider value={sessionValue}>
      <div className={`app-shell learning-demo-shell${isLabActive ? " shell-lab" : ""}`}>
        <Nav
          variant="learner-workbench"
          onHomework={goToHomework}
          onPassport={() => {
            setShowPassport((v) => !v);
            setMobileTab("content");
          }}
        />

      <div className="mobile-tabs" role="tablist">
        {(
          [
            ["course", "课程"],
            ["content", "内容"],
            ["task", "任务"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={mobileTab === id ? "active" : ""}
            aria-selected={mobileTab === id}
            onClick={() => setMobileTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={workspaceClass}>
        <div className="workspace-left">
          {listLoading ? (
            <Skeleton rows={10} />
          ) : error && !days.length ? (
            <ErrorState message={error} onRetry={() => void loadDays()} />
          ) : (
            <SyllabusRail
              days={days}
              weeks={weeks}
              activeDay={activeDay}
              activeNodeId={activeNodeId}
              dayStatuses={dayStatuses}
              dayPkg={dayPkg}
              activeNode={activeNode}
              capsules={learnCapsules}
              openCapsuleId={openCapsuleId}
              readCapsuleIds={readCapsuleIds}
              locked={activeNode?.status === "locked"}
              onSelectDay={handleSelectDay}
              onSelectNode={handleSelectNode}
              onSelectWeekQuiz={handleSelectWeekQuiz}
              onSelectWeekCockpitHomework={handleSelectWeekCockpitHomework}
              week1CockpitHomeworkDone={week1CockpitHomeworkDone}
              onSelectCapsule={(id) => {
                pendingCapsuleRef.current = id;
                setOpenCapsuleId(id);
                setMobileTab("content");
              }}
            />
          )}
        </div>

        <div className="workspace-main">
          {showPassport ? (
            <PassportView />
          ) : !activeDay ? (
            error && !days.length ? (
              <ErrorState message={error} onRetry={() => void loadDays()} />
            ) : (
              <CourseIntro onContinue={goToHomework} />
            )
          ) : dayLoading && !dayPkg ? (
            <Skeleton rows={10} />
          ) : error && !dayPkg && activeDay ? (
            <ErrorState title="本日任务未配置" message={error} onRetry={() => activeDay && void loadDay(activeDay)} />
          ) : weekQuizWeek != null ? (
            <WeekQuiz
              week={weekQuizWeek}
              dayNums={weeks[String(weekQuizWeek)] || []}
              onCompleted={() => {
                void loadDays();
                if (activeDay) void loadDay(activeDay, weekQuizNodeId(weekQuizWeek));
              }}
            />
          ) : weekCockpitHwWeek != null ? (
            <WeekCockpitHomework
              anchorDay={week1AnchorDay}
              onCompleted={() => {
                setWeek1CockpitHomeworkDone(true);
                void refreshWeek1CockpitHomework();
              }}
            />
          ) : (
            <DayView
              day={dayPkg}
              activeNodeId={activeNodeId}
              onRefresh={handleNodeCompleted}
              openCapsuleId={openCapsuleId}
              onOpenCapsuleIdChange={setOpenCapsuleId}
              onReadChange={setReadCapsuleIds}
            />
          )}
        </div>

        <div className="workspace-right">
          <TaskRail
            day={dayPkg}
            node={activeNode}
            homeNextTarget={!activeDay ? homeNextTarget : null}
            onHomeContinue={goToHomework}
            primaryLabel={!activeDay && homeNextTarget ? undefined : primary.label}
            primaryDisabled={primary.disabled}
            onPrimary={() => {
              if (primary.action === "lab" || primary.action === "homework") goToHomework();
              else if (primary.action === "content" && activeNode?.kind === "learn") {
                const next =
                  dayPkg?.nodes.find((n) => n.status === "available" && n.id !== activeNode.id) ||
                  dayPkg?.nodes.find(
                    (n) => n.status !== "locked" && n.status !== "passed" && n.id !== activeNode.id,
                  );
                if (next) focusNode(next.id);
                else setMobileTab("content");
              } else setMobileTab("content");
            }}
            homeworkLabel={
              labNode && activeNode?.kind !== "lab" && primary.action !== "lab" && primary.action !== "homework"
                ? "去做作业"
                : undefined
            }
            homeworkDisabled={labNode?.status === "locked"}
            onHomework={goToHomework}
          />
        </div>
      </div>

      {primary && !showPassport && (
        <div className="mobile-cta">
          <button
            type="button"
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={primary.disabled}
            onClick={() => {
              if (primary.action === "lab" || primary.action === "homework") goToHomework();
              else if (!activeDay) goToHomework();
              else setMobileTab("content");
            }}
          >
            {primary.label}
          </button>
        </div>
      )}
      <CoachFloatingDock />
    </div>
    </LearnerSessionProvider>
  );
}
