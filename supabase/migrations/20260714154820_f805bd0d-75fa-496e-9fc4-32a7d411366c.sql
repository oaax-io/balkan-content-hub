
CREATE POLICY "Admins can view voucher pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'vouchers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert voucher pdfs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vouchers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update voucher pdfs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vouchers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete voucher pdfs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vouchers' AND public.has_role(auth.uid(), 'admin'::app_role));
