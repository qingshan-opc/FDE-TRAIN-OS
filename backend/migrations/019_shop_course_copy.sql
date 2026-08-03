-- Richer catalog copy for shop marketing
UPDATE courses
SET description = '两周任务驱动训练营：从组建 AI 项目团队，到做出可验收交付与 Agent Skill，成为懂业务的技术落地者（FDE）。含隔离实训环境、全程留痕与可核验结业证书。'
WHERE slug = 'fde-two-week'
  AND (
    description IS NULL
    OR description LIKE '%迁移生成%'
    OR length(description) < 40
  );
