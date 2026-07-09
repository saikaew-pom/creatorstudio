-- captions and broll_plan are conceptually one row per project, and the app upserts
-- them with onConflict=project_id. That requires a UNIQUE constraint on project_id —
-- without it PostgREST rejects the upsert (42P10), which was being swallowed silently
-- (saveCaptions didn't check the error). Add the constraints so the upsert works, and
-- de-dupe any pre-existing rows first (there shouldn't be any yet, but be safe).
delete from captions c using captions c2
  where c.project_id = c2.project_id and c.id < c2.id;
delete from broll_plan b using broll_plan b2
  where b.project_id = b2.project_id and b.id < b2.id;

alter table captions add constraint captions_project_id_key unique (project_id);
alter table broll_plan add constraint broll_plan_project_id_key unique (project_id);
