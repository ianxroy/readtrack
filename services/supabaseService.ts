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
  subject_language?: 'en' | 'tl';
  proficiency_level?: string;
  nat_score?: number | null;
  diagnosis_result?: unknown;
  complexity_result?: unknown;
  section_name?: string;
  subject_name?: string;
  teacher_rubric_scores?: unknown;
  original_file?: { base64?: string; storageUrl?: string; mimeType: string; name: string } | null;
}

export interface TeacherRubricScores {
  content: number;
  organization: number;
  languageVocab: number;
  grammar: number;
  mechanics: number;
  overall: number;
  percentage: number;
  transmuted?: number;
}

export interface MaterialUpload {
  material_name: string;
  material_text: string;
  complexity_level?: string;
  complexity_score?: number | null;
  complexity_result?: unknown;
  original_file?: { base64?: string; storageUrl?: string; mimeType: string; name: string } | null;
  teacher_verified_level?: string | null;
  teacher_verified_at?: string | null;
  verification_comment?: string | null;
  is_verified?: boolean;
  subject?: string | null;
}

export interface MaterialTeacherVerification {
  level: 'Independent' | 'Instructional' | 'Frustration';
  comment?: string;
}

const MATERIAL_SUBJECTS_SECTION_NAME = '__material_library_subjects__';

/** Organization data shape: { "Section A": ["Math", "English"], ... } */
export type OrgData = Record<string, string[]>;

function normalizeSubjectList(subjects: string[]): string[] {
  const byLower = new Map<string, string>();
  subjects.forEach((subject) => {
    const normalized = subject.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, normalized);
  });
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
}

function normalizeStudentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const LEGACY_PROFICIENCY_MAP: Record<string, string> = {
  'Frustration':   'Nagsisimula',
  'Instructional': 'Papaunlad',
  'Independent':   'Mahusay',
};

function normalizeProficiency(value: string | undefined): string | undefined {
  if (!value) return value;
  return LEGACY_PROFICIENCY_MAP[value] ?? value;
}

function normalizeGrammarIssue(issue: any, text: string): any {
  if (!issue || 'original' in issue) return issue; // already frontend format
  const { offset = 0, length = 0, replacements = [], message = '', context = '', type = '' } = issue;
  const original = text?.slice(offset, offset + length) ?? '';
  if (!original) return null;
  const t = type.toLowerCase();
  const category = t.includes('vocab') || t.includes('word choice') ? 'vocabulary'
    : t.includes('style') || t.includes('misc') ? 'style'
    : t.includes('clarity') ? 'clarity'
    : 'grammar';
  return { original, suggestion: replacements[0] ?? original, category, context, explanation: message };
}

function normalizeOldLabels(diagnosisResult: any, essayText?: string): any {
  if (!diagnosisResult) return diagnosisResult;
  const result = { ...diagnosisResult };
  if (result.proficiency) {
    result.proficiency = normalizeProficiency(result.proficiency);
  }
  if (result.feedback && typeof result.feedback === 'string') {
    result.feedback = result.feedback
      .replace(/\bFrustration\b/g, 'Nagsisimula')
      .replace(/\bInstructional\b/g, 'Papaunlad')
      .replace(/\bIndependent\b/g, 'Mahusay');
  }
  // Normalize grammar issues from backend format to frontend format
  if (Array.isArray(result.issues) && essayText) {
    result.issues = result.issues
      .map((i: any) => normalizeGrammarIssue(i, essayText))
      .filter(Boolean);
  }
  return result;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ----------------------------------------------------------------
// Storage helpers — compress images + upload to Supabase bucket
// ----------------------------------------------------------------

const STORAGE_BUCKET = 'original-files';

/** Compress an image base64 to JPEG using the canvas API. Max 1200px, quality 0.78. */
async function compressImageBase64(base64: string, sourceMime: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = img.width > MAX ? MAX / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = `data:${sourceMime};base64,${base64}`;
  });
}

/**
 * Upload a single OriginalFile to Supabase Storage.
 * Images are compressed to JPEG first.
 * Returns the public URL, or null on failure.
 */
export async function uploadFileToStorage(
  file: { base64?: string; mimeType: string; name: string },
  folder: 'essays' | 'materials',
): Promise<string | null> {
  if (!file.base64) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    let base64 = file.base64;
    let mimeType = file.mimeType;

    const isCompressible = mimeType.startsWith('image/') && mimeType !== 'image/gif';
    if (isCompressible) {
      try {
        const compressed = await compressImageBase64(base64, mimeType);
        base64    = compressed.base64;
        mimeType  = compressed.mimeType;
      } catch {
        // keep original on compression failure
      }
    }

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: mimeType });
    const ext   = mimeType === 'image/jpeg' ? 'jpg'
                : file.name.includes('.') ? file.name.split('.').pop()!
                : 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${user.id}/${folder}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: mimeType, upsert: false });

    if (error) {
      console.error('Storage upload failed:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error('uploadFileToStorage error:', e);
    return null;
  }
}

/**
 * Upload all OriginalFiles to storage, returning updated copies with storageUrl set
 * and base64 stripped (to keep the DB payload small).
 */
export async function uploadOriginalFilesToStorage(
  files: Array<{ base64?: string; mimeType: string; name: string }>,
  folder: 'essays' | 'materials',
): Promise<Array<{ storageUrl?: string; mimeType: string; name: string }>> {
  return Promise.all(
    files.map(async f => {
      const storageUrl = await uploadFileToStorage(f, folder);
      // Return without base64 so it's not saved to the DB
      return { mimeType: f.mimeType, name: f.name, ...(storageUrl ? { storageUrl } : {}) };
    }),
  );
}

export async function saveTeacherEvaluation(evaluation: TeacherEvaluation): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

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
    teacher_id: user.id,
  }]);

  return { error: error ? error.message : null };
}

export async function saveStudentGradingUpload(upload: StudentGradingUpload): Promise<{ data: any | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const studentNameSha = await sha256Hex(normalizeStudentName(upload.student_name));

  const payload: Record<string, any> = {
    teacher_id: user.id,
    student_name_sha: studentNameSha,
    student_name: upload.student_name,
    essay_title: upload.essay_title,
    essay_text: upload.essay_text,
    proficiency_level: upload.proficiency_level ?? null,
    nat_score: upload.nat_score ?? null,
    diagnosis_result: upload.diagnosis_result ?? null,
    complexity_result: upload.complexity_result ?? null,
    subject_language: upload.subject_language ?? null,
    section_name: upload.section_name ?? null,
    subject_name: upload.subject_name ?? null,
    teacher_rubric_scores: upload.teacher_rubric_scores ?? null,
    original_file: upload.original_file ?? null,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('student_grading_uploads')
      .insert([payload])
      .select()
      .single();

    if (!error) {
      return { data: data ?? null, error: null };
    }

    const msg = error.message || '';
    const missingColumnMatch = msg.match(/Could not find the '([^']+)' column of 'student_grading_uploads'/i);
    const missingColumn = missingColumnMatch?.[1];

    if (missingColumn && missingColumn in payload) {
      console.warn(`student_grading_uploads is missing column '${missingColumn}'. Retrying without it.`);
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error: msg };
  }

  return { data: null, error: 'Insert failed after schema fallback retries' };
}

export async function saveMaterialUpload(upload: MaterialUpload): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const payload: Record<string, any> = {
    teacher_id: user.id,
    material_name: upload.material_name,
    material_text: upload.material_text,
    complexity_level: upload.complexity_level ?? null,
    complexity_score: upload.complexity_score ?? null,
    complexity_result: upload.complexity_result ?? null,
    original_file: upload.original_file ?? null,
    teacher_verified_level: upload.teacher_verified_level ?? null,
    teacher_verified_at: upload.teacher_verified_at ?? null,
    verification_comment: upload.verification_comment ?? null,
    is_verified: upload.is_verified ?? false,
    subject: upload.subject ?? null,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('material_uploads').insert([payload]);
    if (!error) return { error: null };

    const msg = error.message || '';
    const missingColumnMatch = msg.match(/Could not find the '([^']+)' column of 'material_uploads'/i);
    const missingColumn = missingColumnMatch?.[1];

    if (missingColumn && missingColumn in payload) {
      console.warn(`material_uploads is missing column '${missingColumn}'. Retrying without it.`);
      delete payload[missingColumn];
      continue;
    }

    return { error: msg };
  }

  return { error: 'Insert failed after schema fallback retries' };
}

// ----------------------------------------------------------------
// Organization (Section > Subject) — Supabase CRUD
// ----------------------------------------------------------------

/** Load all sections + subjects for the current teacher */
export async function loadOrganization(): Promise<{ data: OrgData; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: {}, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('teacher_organization')
    .select('section_name, subjects')
    .eq('teacher_id', user.id)
    .order('section_name');

  if (error) return { data: {}, error: error.message };

  const org: OrgData = {};
  (data ?? []).forEach((row: any) => {
    org[row.section_name] = row.subjects ?? [];
  });
  return { data: org, error: null };
}

/** Upsert a single section (create or update its subjects list) */
export async function upsertSection(sectionName: string, subjects: string[]): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('teacher_organization')
    .upsert(
      { teacher_id: user.id, section_name: sectionName, subjects, updated_at: new Date().toISOString() },
      { onConflict: 'teacher_id,section_name' },
    );

  return { error: error ? error.message : null };
}

/** Delete a section entirely */
export async function deleteSection(sectionName: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('teacher_organization')
    .delete()
    .eq('teacher_id', user.id)
    .eq('section_name', sectionName);

  return { error: error ? error.message : null };
}

/** Load subject catalog used by Material Library Add Subject panel */
export async function loadMaterialSubjectCatalog(): Promise<{ data: string[]; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('teacher_organization')
    .select('subjects')
    .eq('teacher_id', user.id)
    .eq('section_name', MATERIAL_SUBJECTS_SECTION_NAME)
    .maybeSingle();

  if (error) return { data: [], error: error.message };

  return { data: normalizeSubjectList((data?.subjects ?? []) as string[]), error: null };
}

/** Save subject catalog used by Material Library Add Subject panel */
export async function saveMaterialSubjectCatalog(subjects: string[]): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const normalizedSubjects = normalizeSubjectList(subjects);

  const { error } = await supabase
    .from('teacher_organization')
    .upsert(
      {
        teacher_id: user.id,
        section_name: MATERIAL_SUBJECTS_SECTION_NAME,
        subjects: normalizedSubjects,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'teacher_id,section_name' },
    );

  return { error: error ? error.message : null };
}

// ----------------------------------------------------------------
// Student Grading Uploads — full CRUD (replaces localStorage)
// ----------------------------------------------------------------

export interface StudentUploadRow {
  id: string;
  student_name_sha: string;
  student_name: string | null;
  essay_title: string | null;
  essay_text: string;
  proficiency_level: string | null;
  nat_score: number | null;
  diagnosis_result: any | null;
  complexity_result: any | null;
  subject_language: string | null;
  section_name: string | null;
  subject_name: string | null;
  teacher_rating: number | null;
  teacher_comment: string | null;
  teacher_rubric_scores: TeacherRubricScores | null;
  original_file: any | null;
  created_at: string;
}

export interface StudentLocal {
  id: string;
  name: string;
  section?: string;
  subject?: string;
  subjectLanguage?: string;
  essays: {
    id: string;
    title: string;
    text: string;
    uploadedAt: Date;
    diagnosisResult?: any;
    complexityResult?: any;
    teacherRating?: number;
    teacherComment?: string;
    teacherRubricScores?: TeacherRubricScores;
    originalFile?: { base64: string; mimeType: string; name: string };
  }[];
}

/** Load all student grading uploads for the current teacher, grouped by student name */
export async function loadStudentUploads(): Promise<{ data: StudentLocal[]; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('student_grading_uploads')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  // Group rows by student_name (or student_name_sha as fallback key)
  const studentMap = new Map<string, StudentLocal>();
  (data ?? []).forEach((row: any) => {
    const name = row.student_name || row.student_name_sha || 'Unknown';
    const key = name.toLowerCase().trim();

    if (!studentMap.has(key)) {
      studentMap.set(key, {
        id: row.student_name_sha || row.id,
        name,
        section: row.section_name || undefined,
        subject: row.subject_name || undefined,
        subjectLanguage: row.subject_language || undefined,
        essays: [],
      });
    }

    const student = studentMap.get(key)!;
    student.essays.push({
      id: row.id,
      title: row.essay_title || 'Untitled',
      text: row.essay_text,
      uploadedAt: new Date(row.created_at),
      diagnosisResult: normalizeOldLabels(row.diagnosis_result, row.essay_text) || undefined,
      complexityResult: row.complexity_result || undefined,
      teacherRating: row.teacher_rating || undefined,
      teacherComment: row.teacher_comment || undefined,
      teacherRubricScores: row.teacher_rubric_scores || undefined,
      originalFile: row.original_file || undefined,
    });
  });

  return { data: Array.from(studentMap.values()), error: null };
}

/** Delete a single essay upload by its UUID */
export async function deleteStudentUpload(uploadId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('student_grading_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('teacher_id', user.id);

  return { error: error ? error.message : null };
}

/** Delete all essays for a student (by student_name_sha) */
export async function deleteStudentAllUploads(studentNameSha: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('student_grading_uploads')
    .delete()
    .eq('student_name_sha', studentNameSha)
    .eq('teacher_id', user.id);

  return { error: error ? error.message : null };
}

/** Update teacher rating and comment on an essay */
export async function updateEssayTeacherRating(
  uploadId: string,
  rating: number,
  comment?: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('student_grading_uploads')
    .update({ teacher_rating: rating, teacher_comment: comment ?? null })
    .eq('id', uploadId)
    .eq('teacher_id', user.id);

  return { error: error ? error.message : null };
}

/** Look up the real Supabase UUID for an essay by its text content */
export async function lookupEssayIdByText(essayText: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('student_grading_uploads')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('essay_text', essayText)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/** Save per-dimension teacher rubric scores on an essay */
export async function saveTeacherRubricScores(
  uploadId: string,
  rubricScores: TeacherRubricScores,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('student_grading_uploads')
    .update({ teacher_rubric_scores: rubricScores })
    .eq('id', uploadId)
    .eq('teacher_id', user.id)
    .select('id');

  if (error) return { error: error.message };

  // If no rows were updated, the ID didn't match any row for this teacher.
  if (!data || data.length === 0) {
    return { error: `No row found for essay id=${uploadId}. Upload may have failed.` };
  }

  return { error: null };
}

/** Update essay extracted text for a specific upload row */
export async function updateStudentEssayText(
  uploadId: string,
  essayText: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('student_grading_uploads')
    .update({ essay_text: essayText })
    .eq('id', uploadId)
    .eq('teacher_id', user.id)
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: `No row found for essay id=${uploadId}.` };
  }

  return { error: null };
}

/** Update AI analysis fields after async/background essay processing */
export async function updateStudentUploadAnalysis(
  uploadId: string,
  payload: {
    proficiency_level?: string;
    nat_score?: number | null;
    diagnosis_result?: unknown;
    complexity_result?: unknown;
    original_file?: { storageUrl?: string; mimeType: string; name: string } | null;
  },
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const updatePayload: Record<string, any> = {
    proficiency_level: payload.proficiency_level ?? null,
    nat_score: payload.nat_score ?? null,
    diagnosis_result: payload.diagnosis_result ?? null,
    complexity_result: payload.complexity_result ?? null,
  };
  if (payload.original_file !== undefined) {
    updatePayload.original_file = payload.original_file;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('student_grading_uploads')
      .update(updatePayload)
      .eq('id', uploadId)
      .eq('teacher_id', user.id)
      .select('id');

    if (!error) {
      if (!data || data.length === 0) {
        return { error: `No row found for essay id=${uploadId}.` };
      }
      return { error: null };
    }

    const msg = error.message || '';
    const missingColumnMatch = msg.match(/Could not find the '([^']+)' column of 'student_grading_uploads'/i);
    const missingColumn = missingColumnMatch?.[1];

    if (missingColumn && missingColumn in updatePayload) {
      console.warn(`student_grading_uploads is missing column '${missingColumn}'. Retrying without it.`);
      delete updatePayload[missingColumn];
      continue;
    }

    return { error: msg };
  }

  return { error: 'Update failed after schema fallback retries' };
}

/** Load material uploads for the current teacher */
export async function loadMaterialUploads(): Promise<{ data: any[]; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('material_uploads')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  
  // Format for LibraryMaterial type
  const formatted = (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.material_name,
    text: m.material_text,
    uploadedAt: new Date(m.created_at),
    complexityResult: m.complexity_result,
    teacherVerifiedLevel: m.teacher_verified_level || m.complexity_result?.teacherVerification?.level || undefined,
    teacherVerifiedAt: m.teacher_verified_at || m.complexity_result?.teacherVerification?.verifiedAt || undefined,
    verificationComment: m.verification_comment || m.complexity_result?.teacherVerification?.comment || undefined,
    isVerified: Boolean(m.is_verified || m.teacher_verified_level || m.complexity_result?.teacherVerification?.level),
    subject: m.subject || undefined,
    originalFile:
      m.original_file ||
      m.complexity_result?.originalFile ||
      m.complexity_result?.original_file ||
      undefined,
  }));

  return { data: formatted, error: null };
}

export async function saveMaterialTeacherVerification(
  materialId: string,
  verification: MaterialTeacherVerification,
  existingComplexityResult?: any,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const verifiedAt = new Date().toISOString();
  const mergedComplexityResult = {
    ...(existingComplexityResult || {}),
    teacherVerification: {
      level: verification.level,
      comment: verification.comment || null,
      verifiedAt,
    },
  };

  const payload: Record<string, any> = {
    teacher_verified_level: verification.level,
    teacher_verified_at: verifiedAt,
    verification_comment: verification.comment || null,
    is_verified: true,
    complexity_level: verification.level,
    complexity_result: mergedComplexityResult,
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase
      .from('material_uploads')
      .update(payload)
      .eq('id', materialId)
      .eq('teacher_id', user.id);

    if (!error) return { error: null };

    const msg = error.message || '';
    const missingColumnMatch = msg.match(/Could not find the '([^']+)' column of 'material_uploads'/i);
    const missingColumn = missingColumnMatch?.[1];

    if (missingColumn && missingColumn in payload) {
      console.warn(`material_uploads is missing column '${missingColumn}'. Retrying without it.`);
      delete payload[missingColumn];
      continue;
    }

    return { error: msg };
  }

  return { error: 'Update failed after schema fallback retries' };
}

export async function updateMaterialSubject(
  materialId: string,
  subject: string | null,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase
    .from('material_uploads')
    .update({ subject: subject || null })
    .eq('id', materialId)
    .eq('teacher_id', user.id);
  return { error: error?.message ?? null };
}

/** Delete a material upload by its UUID */
export async function deleteMaterialUpload(uploadId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('material_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('teacher_id', user.id);

  return { error: error ? error.message : null };
}

/** Load dashboard statistics from the database */
export async function loadDashboardStats(): Promise<{
  totalStudents: number;
  totalEssays: number;
  totalMaterials: number;
  ratedEssays: number;
  avgTeacherRating: string;
  proficiencyCounts: Record<string, number>;
  complexityCounts: Record<string, number>;
  error: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  const empty = {
    totalStudents: 0, totalEssays: 0, totalMaterials: 0,
    ratedEssays: 0, avgTeacherRating: 'N/A',
    proficiencyCounts: { Nagsisimula: 0, Papaunlad: 0, Mahusay: 0 },
    complexityCounts: { Independent: 0, Instructional: 0, Frustration: 0 },
    error: null as string | null,
  };
  if (!user) return { ...empty, error: 'Not authenticated' };

  // Fetch essays
  const { data: essays, error: essayErr } = await supabase
    .from('student_grading_uploads')
    .select('*')
    .eq('teacher_id', user.id);

  // Fetch materials
  const { data: materials, error: matErr } = await supabase
    .from('material_uploads')
    .select('complexity_level')
    .eq('teacher_id', user.id);

  if (essayErr || matErr) return { ...empty, error: (essayErr || matErr)!.message };

  const studentNames = new Set((essays ?? []).map((e: any) => e.student_name_sha));
  const ratings = (essays ?? [])
    .map((e: any) => e.teacher_rating)
    .filter((r: any) => typeof r === 'number' && r > 0);

  const proficiencyCounts: Record<string, number> = { Nagsisimula: 0, Papaunlad: 0, Mahusay: 0 };
  (essays ?? []).forEach((e: any) => {
    const normalized = normalizeProficiency(e.proficiency_level);
    if (normalized && normalized in proficiencyCounts) {
      proficiencyCounts[normalized] += 1;
    }
  });

  const complexityCounts: Record<string, number> = { Independent: 0, Instructional: 0, Frustration: 0 };
  (materials ?? []).forEach((m: any) => {
    if (m.complexity_level && m.complexity_level in complexityCounts) {
      complexityCounts[m.complexity_level] += 1;
    }
  });

  return {
    totalStudents: studentNames.size,
    totalEssays: (essays ?? []).length,
    totalMaterials: (materials ?? []).length,
    ratedEssays: ratings.length,
    avgTeacherRating: ratings.length
      ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1)
      : 'N/A',
    proficiencyCounts,
    complexityCounts,
    error: null,
  };
}
