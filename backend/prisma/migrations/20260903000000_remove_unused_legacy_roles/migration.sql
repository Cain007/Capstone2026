DELETE FROM "Role" AS role
WHERE role."name" IN ('Manager', 'Viewer')
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS user_record
    WHERE user_record."roleId" = role."id"
  );