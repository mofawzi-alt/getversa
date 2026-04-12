
ALTER TABLE public.users 
ADD COLUMN verified_public_figure boolean NOT NULL DEFAULT false,
ADD COLUMN verified_category text NULL;

ALTER TABLE public.votes
ADD COLUMN is_public_vote boolean NOT NULL DEFAULT false;
