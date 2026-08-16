UPDATE camps SET name = 'FDE 训练营' WHERE name = 'FDE 0期 v0.3';

UPDATE course_offerings o
SET title = c.title
FROM courses c
JOIN course_versions v ON v.course_id = c.id
WHERE o.course_version_id = v.id
  AND o.title IS DISTINCT FROM c.title
  AND (
    o.title IN ('FDE 0期 v0.3', 'FDE 训练营')
    OR o.title IS NULL
    OR btrim(o.title) = ''
  );

UPDATE courses SET title = 'FDE 训练营' WHERE title = 'FDE 0期 v0.3';
UPDATE course_offerings SET title = 'FDE 训练营' WHERE title = 'FDE 0期 v0.3';
