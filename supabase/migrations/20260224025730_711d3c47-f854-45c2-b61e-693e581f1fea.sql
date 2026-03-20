-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete clientes (cascade user data)
CREATE POLICY "Admins can delete clientes"
ON public.clientes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));