-- Security hardening: enforce learning access at the database boundary.
-- Apply only through the reviewed Supabase migration process; do not run manually in production.

BEGIN;

-- A published lesson is not necessarily free. Require a current enrollment at the
-- database layer so direct PostgREST requests cannot bypass Worker checks.
DROP POLICY IF EXISTS published_lessons_read ON public.lessons;
DROP POLICY IF EXISTS enrolled_published_lessons_read ON public.lessons;
CREATE POLICY enrolled_published_lessons_read
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.course_modules AS m
      JOIN public.courses AS c ON c.id = m.course_id
      JOIN public.enrollments AS e ON e.course_id = c.id
      WHERE m.id = lessons.module_id
        AND c.is_published = true
        AND e.student_id = (SELECT auth.uid())
        AND e.status IN ('active', 'completed')
    )
  );

-- Do not let anonymous or authenticated clients create or modify their own
-- enrollment records. Trusted server-side service-role workflows remain responsible
-- for creating/maintaining enrollment records.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.enrollments TO authenticated;

DROP POLICY IF EXISTS own_enrollments_insert ON public.enrollments;

-- Reading answer keys and explanations must not be selectable from the client API.
-- Expose only question/passage fields to authenticated clients. A future trusted
-- grading/review endpoint must return feedback only at the intended assessment stage.
REVOKE ALL PRIVILEGES ON TABLE public.reading_questions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  passage_id,
  question_number,
  question_type,
  question_text,
  options,
  difficulty,
  band_level,
  status,
  created_at,
  updated_at
) ON TABLE public.reading_questions TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
