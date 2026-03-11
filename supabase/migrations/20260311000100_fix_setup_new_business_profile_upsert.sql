-- Ensure setup_new_business works even if profile row is missing
CREATE OR REPLACE FUNCTION public.setup_new_business(
  _name text,
  _legal_name text DEFAULT NULL,
  _tax_id text DEFAULT NULL,
  _tax_rate numeric DEFAULT 0,
  _currency text DEFAULT 'INR',
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _business_id uuid;
  _branch_id uuid;
  _existing_business_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If the user signed up before migrations were applied, they may not have a profile row yet.
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    _user_id,
    COALESCE((SELECT au.raw_user_meta_data->>'full_name' FROM auth.users au WHERE au.id = _user_id), NULL)
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT business_id INTO _existing_business_id
  FROM public.profiles
  WHERE user_id = _user_id;

  IF _existing_business_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a business';
  END IF;

  INSERT INTO public.businesses (name, legal_name, tax_id, tax_rate, currency, email, phone, address)
  VALUES (_name, _legal_name, _tax_id, _tax_rate, _currency, _email, _phone, _address)
  RETURNING id INTO _business_id;

  INSERT INTO public.branches (business_id, name)
  VALUES (_business_id, 'Main Branch')
  RETURNING id INTO _branch_id;

  UPDATE public.profiles
  SET business_id = _business_id, branch_id = _branch_id
  WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object(
    'business_id', _business_id,
    'branch_id', _branch_id
  );
END;
$$;

