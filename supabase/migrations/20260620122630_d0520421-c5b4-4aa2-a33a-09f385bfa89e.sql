
-- 1) Add username column to profiles (unique, optional, lowercase)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2) Update handle_new_user to also store username from signup metadata if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pengajar');
  RETURN NEW;
END;
$function$;

-- 3) Allow users (and admins) to delete attendances
CREATE POLICY "Users can delete own attendances"
  ON public.attendances FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete attendances"
  ON public.attendances FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Allow admins to delete attendance files in storage
CREATE POLICY "Admins can delete attendance files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND public.has_role(auth.uid(), 'admin')
  );
