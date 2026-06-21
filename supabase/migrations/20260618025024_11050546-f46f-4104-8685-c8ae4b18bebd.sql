
-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies: each user owns files under attendance-docs/<user_id>/...
CREATE POLICY "Users can view own attendance files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all attendance files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can upload own attendance files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own attendance files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
