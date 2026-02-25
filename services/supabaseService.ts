import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eaicqmwicqapwwpeuyjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaWNxbXdpY3FhcHd3cGV1eWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDQwNTEsImV4cCI6MjA4NzYyMDA1MX0.hrFzV5nfNo-472kCsmZnf66hrMenBsNYdfq1Sng5Vs0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface TeacherEvaluation {
  student_text: string;
  proficiency_level: string;
  nat_score: number;
  rating: number; // 1-5 stars
  comment?: string;
}

export async function saveTeacherEvaluation(evaluation: TeacherEvaluation): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('teacher_evaluations').insert([{
    ...evaluation,
    teacher_id: user?.id ?? null,
  }]);

  return { error: error ? error.message : null };
}
