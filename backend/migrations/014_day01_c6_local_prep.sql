-- Seed local_prep on Day 1 capsule c6 for demo learner workbench (aligns with contracts/examples/day-01-curriculum.yaml).

UPDATE day_packages dp
SET package_json = jsonb_set(
  dp.package_json,
  '{learn,capsules}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN cap->>'id' = 'c6' THEN
            cap || jsonb_build_object(
              'local_prep',
              jsonb_build_object(
                'skill_id', 'fde-local-prep',
                'codex_prompt',
                E'你正在完成 FDE 训练营 Day 1 企业库存列表页任务。\n\n企业背景：老板说「我要能打开一个页面，看到每个 SKU 还剩多少，哪些已经低于警戒线」。\n任务：围绕经营目标、页面信息架构、示例数据与验收标准，帮助我形成初步判断。\n要求：先向我提出 3 个澄清问题，不要直接给出完整 HTML。',
                'checklist',
                jsonb_build_array(
                  '写清老板真正关心的经营结果（不是功能清单）',
                  '列出页面必须出现的字段（SKU / 名称 / 库存 / 警戒线）',
                  '准备至少 3 行示例数据（含一行低于警戒线）',
                  '说明 10 秒内导师能否看懂这是库存列表',
                  '识别一个可能的组织或流程阻力'
                ),
                'template_resource_id', 'agent-lab-guide',
                'suggested_questions',
                jsonb_build_array(
                  '我不知道表格里还必须有哪些列',
                  '示例数据怎样才算「能验收」',
                  '老板原话和页面标题应该怎么对应'
                )
              )
            )
          ELSE cap
        END
      ),
      dp.package_json #> '{learn,capsules}'
    )
    FROM jsonb_array_elements(COALESCE(dp.package_json #> '{learn,capsules}', '[]'::jsonb)) AS cap
  )
)
FROM course_versions cv
WHERE cv.id = dp.course_version_id
  AND cv.camp_id = 'camp-v03'
  AND dp.day = 1
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(dp.package_json #> '{learn,capsules}', '[]'::jsonb)) AS cap
    WHERE cap->>'id' = 'c6'
  );

INSERT INTO schema_migrations (version) VALUES ('014_day01_c6_local_prep')
ON CONFLICT (version) DO NOTHING;
