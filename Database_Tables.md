This is a definition of the tables for reference:

CREATE TABLE public.free_grants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_id text,
  device_id text,
  received_grant boolean,
  grant_amount bigint,
  CONSTRAINT free_grants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.token_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tokens bigint,
  user_id text,
  note text,
  tokens_monthly bigint,
  tokens_added bigint,
  CONSTRAINT token_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  bio text,
  auth_id text,
  anon_id text,
  tokens_used bigint,
  reset_date text,
  token_limit bigint,
  tokens_used_all_time bigint,
  tokens_added bigint,
  email text,
  password text,
  tier_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_end_date text,
  next_billing_date text,
  tokens_monthly bigint,
  device_id text,
  free_auth_grant_used boolean,
  free_device_grant_used boolean,
  email_confirmed_at text,
  confirmation_token text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);