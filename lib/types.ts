export type Alias = {
  id: string;
  prefix: string;
  user_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  alias_id: string;
  to_address: string | null;
  from_address: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  spam_verdict: string | null;
  spam_score: string | null;
  received_at: string;
  created_at: string;
};
