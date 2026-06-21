ALTER TABLE public.attendances ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.attendances ADD COLUMN custom_school_name text;
ALTER TABLE public.attendances ADD COLUMN custom_price integer;
ALTER TABLE public.attendances ADD CONSTRAINT attendances_school_or_custom_chk CHECK (school_id IS NOT NULL OR (custom_school_name IS NOT NULL AND length(btrim(custom_school_name)) > 0));

CREATE POLICY "Admins can update attendances" ON public.attendances
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));