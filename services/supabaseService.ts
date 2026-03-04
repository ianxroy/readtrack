import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eaicqmwicqapwwpeuyjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaWNxbXdpY3FhcHd3cGV1eWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDQwNTEsImV4cCI6MjA4NzYyMDA1MX0.hrFzV5nfNo-472kCsmZnf66hrMenBsNYdfq1Sng5Vs0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface TeacherEvaluation {
  student_text: string;
  student_name?: string;
  proficiency_level: string;
  nat_score?: number | null;
  rating: number; // 1-5 stars
  comment?: string;
}

export interface StudentGradingUpload {
  student_name: string;
  essay_title: string;
  essay_text: string;
  proficiency_level?: string;
  nat_score?: number | null;
  diagnosis_result?: unknown;
  complexity_result?: unknown;
}

export interface MaterialUpload {
  material_name: string;
  material_text: string;
  complexity_level?: string;
  complexity_score?: number | null;
  complexity_result?: unknown;
}

function normalizeStudentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function saveTeacherEvaluation(evaluation: TeacherEvaluation): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  const studentNameSha = evaluation.student_name
    ? await sha256Hex(normalizeStudentName(evaluation.student_name))
    : null;

  const { error } = await supabase.from('teacher_evaluations').insert([{
    student_text: evaluation.student_text,
    proficiency_level: evaluation.proficiency_level,
    nat_score: evaluation.nat_score,
    rating: evaluation.rating,
    comment: evaluation.comment,
    student_name_sha: studentNameSha,
    teacher_id: user?.id ?? null,
  }]);

  return { error: error ? error.message : null };
}

export async function saveStudentGradingUpload(upload: StudentGradingUpload): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  const studentNameSha = await sha256Hex(normalizeStudentName(upload.student_name));

  const { error } = await supabase.from('student_grading_uploads').insert([{
    teacher_id: user?.id ?? null,
    student_name_sha: studentNameSha,
    essay_title: upload.essay_title,
    essay_text: upload.essay_text,
    proficiency_level: upload.proficiency_level ?? null,
    nat_score: upload.nat_score ?? null,
    diagnosis_result: upload.diagnosis_result ?? null,
    complexity_result: upload.complexity_result ?? null,
  }]);

  return { error: error ? error.message : null };
}

export async function saveMaterialUpload(upload: MaterialUpload): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('material_uploads').insert([{
    teacher_id: user?.id ?? null,
    material_name: upload.material_name,
    material_text: upload.material_text,
    complexity_level: upload.complexity_level ?? null,
    complexity_score: upload.complexity_score ?? null,
    complexity_result: upload.complexity_result ?? null,
  }]);

  return { error: error ? error.message : null };
}
