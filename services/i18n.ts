import { useState, useEffect } from 'react';
import {
  getUILanguagePreference,
  subscribeUILanguagePreferenceChange,
  UILanguagePreference,
} from './uiSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'fil';
type Translations = Record<string, { en: string; fil: string }>;

// ─── Translation table ────────────────────────────────────────────────────────

export const STRINGS = {
  // ── Navigation ──
  nav_dashboard:        { en: 'Dashboard',             fil: 'Pangkalahatang-Tanaw' },
  nav_essay_grading:    { en: 'Essay Grading',         fil: 'Pagtatasa ng Sanaysay' },
  nav_material_library: { en: 'Material Library',      fil: 'Aklatan ng Materyal' },
  nav_settings:         { en: 'Settings',              fil: 'Mga Setting' },
  nav_about:            { en: 'About',                 fil: 'Tungkol Sa' },
  nav_signed_in:        { en: 'Signed in',             fil: 'Naka-sign in' },
  nav_recent:           { en: 'Recent',                fil: 'Kamakailang' },
  nav_today:            { en: 'Today',                 fil: 'Ngayon' },
  nav_yesterday:        { en: 'Yesterday',             fil: 'Kahapon' },
  nav_last_7_days:      { en: 'Last 7 days',           fil: 'Nakaraang 7 Araw' },
  nav_older:            { en: 'Older',                 fil: 'Mas Luma' },

  // ── Dashboard ──
  dash_badge:           { en: 'ReadTrack Analytics',   fil: 'Analytics ng ReadTrack' },
  dash_title:           { en: 'Dashboard Overview',    fil: 'Pangkalahatang-Tanaw' },
  dash_subtitle:        { en: 'Grade 7 reading complexity and essay proficiency snapshot', fil: 'Buod ng kumplikasyon ng pagbabasa at kahusayan sa sanaysay ng Grade 7' },
  dash_students:        { en: 'Students',              fil: 'Mga Estudyante' },
  dash_students_sub:    { en: 'with at least one essay', fil: 'na may kahit isang sanaysay' },
  dash_essays:          { en: 'Essays',                fil: 'Mga Sanaysay' },
  dash_essays_sub:      { en: 'submitted for scoring', fil: 'isinumite para sa pagmamarka' },
  dash_materials:       { en: 'Materials',             fil: 'Mga Materyal' },
  dash_materials_sub:   { en: 'uploaded in library',   fil: 'na-upload sa aklatan' },
  dash_avg_rating:      { en: 'Avg Teacher Rating',    fil: 'Karaniwang Marka ng Guro' },
  dash_rated_essays:    { en: 'rated essays',          fil: 'mga markadong sanaysay' },
  dash_loading:         { en: 'Loading dashboard…',    fil: 'Naglo-load ng dashboard…' },

  // Distribution charts
  dash_prof_title:      { en: 'Essay Proficiency',     fil: 'Kahusayan sa Sanaysay' },
  dash_prof_sub:        { en: 'How well are your students writing?', fil: 'Gaano kahusay ang pagsulat ng iyong mga estudyante?' },
  dash_comp_title:      { en: 'Material Complexity (Phil-IRI)', fil: 'Kumplikasyon ng Materyal (Phil-IRI)' },
  dash_comp_sub:        { en: 'Are your materials right for Grade 7 students?', fil: 'Angkop ba ang iyong mga materyal para sa Grade 7?' },
  dash_total:           { en: 'total',                 fil: 'kabuuan' },

  // Phil-IRI levels
  level_independent:    { en: 'Independent',           fil: 'Independyente' },
  level_instructional:  { en: 'Instructional',         fil: 'Instruksyonal' },
  level_frustration:    { en: 'Frustration',           fil: 'Mahirap' },
  level_easy:           { en: 'Easy, G7 Readable',     fil: 'Madali, Mababasa ng Grade 7' },
  level_moderate:       { en: 'Moderate, Borderline',  fil: 'Katamtaman, Hangganan' },
  level_difficult:      { en: 'Difficult, Above G7',   fil: 'Mahirap, Higit sa Grade 7' },

  // Proficiency levels
  prof_beginning:       { en: 'Beginning',             fil: 'Nagsisimula' },
  prof_developing:      { en: 'Developing',            fil: 'Papaunlad' },
  prof_proficient:      { en: 'Proficient',            fil: 'Mahusay' },

  // Action cards
  dash_upload_title:    { en: 'Upload a Material',     fil: 'Mag-upload ng Materyal' },
  dash_upload_desc:     { en: 'Check if a reading material is appropriate for Grade 7 students using the Phil-IRI model.', fil: 'Suriin kung ang isang materyal sa pagbabasa ay angkop para sa mga estudyante ng Grade 7 gamit ang Phil-IRI model.' },
  dash_upload_btn:      { en: 'Go to Material Library', fil: 'Pumunta sa Aklatan ng Materyal' },
  dash_grade_title:     { en: 'Grade an Essay',        fil: 'Markahan ang Sanaysay' },
  dash_grade_desc:      { en: 'Score essays and estimate each student\'s reading proficiency level with AI assistance.', fil: 'Markahan ang mga sanaysay at tantiyahin ang antas ng kahusayan sa pagbabasa ng bawat estudyante gamit ang tulong ng AI.' },
  dash_grade_btn:       { en: 'Go to Essay Grading',  fil: 'Pumunta sa Pagtatasa ng Sanaysay' },
  dash_howto:           { en: 'How to read this',      fil: 'Paano Basahin Ito' },
  dash_howto_desc:      { en: 'Complexity checks if materials are readable for Grade 7 using Phil-IRI levels (Independent / Instructional / Frustration). Proficiency evaluates student essay quality. These are separate AI models that work together.', fil: 'Sinusuri ng Kumplikasyon kung mababasa ang mga materyal para sa Grade 7 gamit ang mga antas ng Phil-IRI (Independyente / Instruksyonal / Mahirap). Sinusuri ng Kahusayan ang kalidad ng sanaysay ng estudyante. Magkaibang AI models ang gumagawa ng dalawang ito nang magkasama.' },
  dash_learn_more:      { en: 'Learn more in About', fil: 'Matuto pa sa Tungkol Sa' },
  dash_complexity_lbl:  { en: 'Complexity',            fil: 'Kumplikasyon' },
  dash_proficiency_lbl: { en: 'Proficiency',           fil: 'Kahusayan' },

  // ── Settings ──
  settings_title:       { en: 'Settings',              fil: 'Mga Setting' },
  settings_subtitle:    { en: 'Customize the app interface for your classroom workflow.', fil: 'I-customize ang interface ng app para sa iyong daloy ng trabaho sa silid-aralan.' },
  settings_lang_title:  { en: 'Global UI Language',    fil: 'Pangkalahatang Wika ng UI' },
  settings_lang_desc:   { en: 'Choose how labels and interface text are shown across the app.', fil: 'Piliin kung paano ipapakita ang mga label at teksto ng interface sa buong app.' },
  settings_automatic:   { en: 'Automatic',             fil: 'Awtomatiko' },
  settings_english:     { en: 'English',               fil: 'Ingles' },
  settings_tagalog:     { en: 'Tagalog',               fil: 'Tagalog' },

  // ── StudentGrading Sidebar ──
  sidebar_essay_grading:{ en: 'Essay Grading',         fil: 'Pagtatasa ng Sanaysay' },
  sidebar_student:      { en: 'student',               fil: 'estudyante' },
  sidebar_students:     { en: 'students',              fil: 'mga estudyante' },
  sidebar_upload_essay: { en: 'Upload Essay',          fil: 'Mag-upload ng Sanaysay' },
  sidebar_sections:     { en: 'Sections',              fil: 'Mga Seksyon' },
  sidebar_subjects:     { en: 'Subjects',              fil: 'Mga Paksa' },
  sidebar_rename:       { en: 'Rename',                fil: 'Palitan ng Pangalan' },
  sidebar_delete:       { en: 'Delete',                fil: 'Burahin' },
  sidebar_section_ph:   { en: 'Section name…',         fil: 'Pangalan ng seksyon…' },
  sidebar_add_section:  { en: 'Add Section',           fil: 'Magdagdag ng Seksyon' },

  // ── MaterialLibrary ──
  mat_library:          { en: 'Material Library',      fil: 'Aklatan ng Materyal' },
  mat_upload_btn:       { en: 'Upload Material',       fil: 'Mag-upload ng Materyal' },
  mat_analyzing:        { en: 'Analyzing…',            fil: 'Sinusuri…' },
  mat_subjects:         { en: 'Subjects',              fil: 'Mga Paksa' },
  mat_add:              { en: 'Add',                   fil: 'Magdagdag' },
  mat_all_subjects:     { en: 'All Subjects',          fil: 'Lahat ng Paksa' },
  mat_add_subject_ph:   { en: 'New subject name…',     fil: 'Bagong pangalan ng paksa…' },
  mat_add_subject_btn:  { en: 'Add Subject',           fil: 'Magdagdag ng Paksa' },
  mat_saving:           { en: 'Saving…',               fil: 'Sine-save…' },
  mat_all_materials:    { en: 'All Materials',         fil: 'Lahat ng Materyal' },
  mat_search_ph:        { en: 'Search materials…',     fil: 'Maghanap ng materyal…' },
  mat_sort_newest:      { en: 'Newest first',          fil: 'Pinakabago muna' },
  mat_sort_oldest:      { en: 'Oldest first',          fil: 'Pinakamatanda muna' },
  mat_sort_score_high:  { en: 'Score: high → low',     fil: 'Marka: mataas → mababa' },
  mat_sort_score_low:   { en: 'Score: low → high',     fil: 'Marka: mababa → mataas' },
  mat_sort_name:        { en: 'Name A–Z',              fil: 'Pangalan A–Z' },
  mat_filter_all:       { en: 'All',                   fil: 'Lahat' },
  mat_filter_all_lang:  { en: 'All Lang',              fil: 'Lahat ng Wika' },
  mat_empty_title:      { en: 'No materials yet',      fil: 'Wala pang mga materyal' },
  mat_empty_desc:       { en: 'Upload a reading material to get started.', fil: 'Mag-upload ng materyal sa pagbabasa para magsimula.' },
  mat_no_match:         { en: 'No materials match the current filters.', fil: 'Walang materyal na tumutugma sa mga filter.' },
  mat_loading:          { en: 'Loading materials…',    fil: 'Naglo-load ng mga materyal…' },
  mat_col_material:     { en: 'Material',              fil: 'Materyal' },
  mat_col_level:        { en: 'Level',                 fil: 'Antas' },
  mat_col_score:        { en: 'Score',                 fil: 'Marka' },
  mat_col_verified:     { en: 'Verified',              fil: 'Na-verify' },
  mat_teacher_verification: { en: 'Teacher Verification (Improves Model Reliability)', fil: 'Pagpapatunay ng Guro (Nagpapabuti ng Katumpakan ng Modelo)' },
  mat_optional_note:    { en: 'Optional note on why this level is correct…', fil: 'Opsyonal na tala kung bakit tama ang antas na ito…' },
  mat_save_verification:{ en: 'Save Verification',     fil: 'I-save ang Pagpapatunay' },
  mat_saving_verification: { en: 'Saving…',            fil: 'Sine-save…' },
  mat_confirm_level:       { en: 'Confirm Material Level', fil: 'Kumpirmahin ang Antas ng Materyal' },
  mat_model_predicted:     { en: 'Model predicted:',    fil: 'Hula ng modelo:' },
  mat_title_label:         { en: 'Material Title',      fil: 'Pamagat ng Materyal' },
  mat_title_ph:            { en: 'Enter material title', fil: 'Ilagay ang pamagat ng materyal' },
  mat_original_file:       { en: 'Original File',       fil: 'Orihinal na File' },
  mat_new_material:        { en: 'New Material',        fil: 'Bagong Materyal' },
  mat_upload_desc:         { en: 'Upload reading material for instant complexity analysis', fil: 'Mag-upload ng materyal sa pagbabasa para sa agarang pagsusuri ng kumplikasyon' },
  mat_extracted_text:      { en: 'Extracted Text',          fil: 'Na-extract na Teksto' },
  mat_save_text:           { en: 'Save Text',               fil: 'I-save ang Teksto' },
  mat_no_preview:          { en: 'No preview available.',   fil: 'Walang preview.' },
  mat_word_doc:            { en: 'Word Document — no browser preview available', fil: 'Word Document — walang browser preview' },
  mat_no_preview_type:     { en: 'No preview available for this file type.', fil: 'Walang preview para sa uri ng file na ito.' },
  mat_no_original:         { en: 'No original file attached.', fil: 'Walang orihinal na file na nakalakip.' },
  mat_extracted_right:     { en: 'Extracted text is shown on the right', fil: 'Ang na-extract na teksto ay makikita sa kanan' },
  mat_model_recommendation:{ en: 'Model Recommendation',   fil: 'Rekomendasyon ng Modelo' },
  mat_is_correct:          { en: 'Is this recommendation correct?', fil: 'Tama ba ang rekomendasyon na ito?' },
  mat_keep_or_choose:      { en: 'Keep the model suggestion, or choose a different level manually.', fil: 'Panatilihin ang mungkahi ng modelo, o pumili ng ibang antas nang mano-mano.' },
  mat_keep:                { en: 'Keep',                    fil: 'Panatilihin' },
  mat_choose_manually:     { en: 'Choose manually',         fil: 'Pumili nang mano-mano' },
  mat_select_manual:       { en: 'Select the manual level:', fil: 'Piliin ang manu-manong antas:' },
  mat_note:                { en: 'Note',                    fil: 'Tala' },
  mat_optional:            { en: '(optional)',              fil: '(opsyonal)' },
  mat_will_save_as:        { en: 'Will be saved as:',       fil: 'Ise-save bilang:' },
  mat_hide_extracted:      { en: 'Hide extracted text',     fil: 'Itago ang na-extract na teksto' },
  mat_show_extracted:      { en: 'Show extracted text',     fil: 'Ipakita ang na-extract na teksto' },
  mat_words:               { en: 'words',                   fil: 'salita' },
  mat_image:               { en: 'Image',                   fil: 'Larawan' },

  // ── UploadModal ──
  upload_grade_essay:    { en: 'Grade Essay',              fil: 'Markahan ang Sanaysay' },
  upload_instant_analysis: { en: 'Upload student work for instant analysis', fil: 'Mag-upload ng gawa ng estudyante para sa agarang pagsusuri' },
  upload_extracting:     { en: 'Extracting text…',         fil: 'Kina-kuha ang teksto…' },
  upload_reading_image:  { en: 'Reading text from image · may take a moment', fil: 'Nagbabasa ng teksto mula sa larawan · maaaring matagal' },
  upload_drag_more:      { en: 'Click or drag to add more', fil: 'I-click o i-drag para magdagdag' },
  upload_drag_file:      { en: 'Click or drag a file',     fil: 'I-click o i-drag ang file' },
  upload_file_types:     { en: 'PDF, Image, TXT, or DOCX · Max 10MB', fil: 'PDF, Larawan, TXT, o DOCX · Max 10MB' },
  upload_images_label:   { en: 'Images',                   fil: 'Mga Larawan' },
  upload_drag_reorder:   { en: 'drag to reorder',          fil: 'i-drag para ayusin' },
  upload_scan:           { en: 'Scan',                     fil: 'I-scan' },
  upload_image_sing:     { en: 'Image',                    fil: 'Larawan' },
  upload_images_plur:    { en: 'Images',                   fil: 'Mga Larawan' },
  upload_scanning:       { en: 'Scanning…',                fil: 'Nag-sca-scan…' },
  upload_section:        { en: 'Section',                  fil: 'Seksyon' },
  upload_new:            { en: 'New',                      fil: 'Bago' },
  upload_all_sections:   { en: 'All sections…',            fil: 'Lahat ng seksyon…' },
  upload_student:        { en: 'Student',                  fil: 'Estudyante' },
  upload_sec_first:      { en: 'Select a section first…',  fil: 'Pumili muna ng seksyon…' },
  upload_student_ph:     { en: 'Student name…',            fil: 'Pangalan ng estudyante…' },
  upload_select_student: { en: 'Select student…',          fil: 'Pumili ng estudyante…' },
  upload_subject:        { en: 'Subject',                  fil: 'Paksa' },
  upload_subject_ph:     { en: 'Subject name…',            fil: 'Pangalan ng paksa…' },
  upload_select_subject: { en: 'Select subject…',          fil: 'Pumili ng paksa…' },
  upload_title_opt:      { en: 'Title — optional',         fil: 'Pamagat — opsyonal' },
  upload_title_ph:       { en: 'e.g. Narrative Essay #1',  fil: 'hal. Sanaysay na Salaysay Blg. 1' },
  upload_essay_content:  { en: 'Essay Content',            fil: 'Nilalaman ng Sanaysay' },
  upload_essay_ph:       { en: 'Paste essay text here, or upload a file above…', fil: 'I-paste ang teksto ng sanaysay dito, o mag-upload ng file sa itaas…' },
  upload_analyzing:      { en: 'Analyzing…',               fil: 'Sinusuri…' },
  upload_analyze_grade:  { en: 'Analyze & Grade →',        fil: 'Suriin at Markahan →' },
  upload_analyzing_title:{ en: 'Analyzing Essay',          fil: 'Sinusuri ang Sanaysay' },
  upload_analysis_wait:  { en: 'This may take a moment for longer essays or image uploads.', fil: 'Maaaring matagal para sa mas mahabang sanaysay o mga larawan.' },
  upload_step_1:         { en: 'Preparing the submission...', fil: 'Inihahanda ang isinumite...' },
  upload_step_2:         { en: 'Checking writing quality and language use...', fil: 'Sinusuri ang kalidad ng pagsulat at paggamit ng wika...' },
  upload_step_3:         { en: 'Reviewing reading level fit...', fil: 'Sinusuri ang angkop na antas ng pagbabasa...' },
  upload_step_4:         { en: 'Saving results for teacher review...', fil: 'Sine-save ang mga resulta para sa pagsusuri ng guro...' },
  upload_err_size:       { en: 'File exceeds 10MB limit.', fil: 'Lumampas ang file sa limitasyong 10MB.' },
  upload_err_docx:       { en: 'Could not extract text from this .docx file. Please paste the text manually.', fil: 'Hindi ma-kuha ang teksto mula sa .docx file na ito. Mangyaring i-paste ang teksto nang mano-mano.' },
  upload_err_docx_fail:  { en: 'Failed to read .docx file. Please paste the text manually.', fil: 'Nabigo ang pagbabasa ng .docx file. Mangyaring i-paste ang teksto nang mano-mano.' },
  upload_err_failed:     { en: 'Upload failed.',            fil: 'Nabigo ang pag-upload.' },
  upload_err_scanner:    { en: 'Text scanning is temporarily unavailable. Please contact your administrator.', fil: 'Pansamantalang hindi available ang pag-scan ng teksto. Makipag-ugnayan sa iyong administrator.' },
  upload_err_no_setup:   { en: 'Text scanning is not set up yet. Please contact your administrator.', fil: 'Hindi pa na-setup ang pag-scan ng teksto. Makipag-ugnayan sa iyong administrator.' },
  upload_err_ocr_unavail:{ en: 'Text scanning is currently unavailable. Please contact your administrator.', fil: 'Hindi available ang pag-scan ng teksto ngayon. Makipag-ugnayan sa iyong administrator.' },

  // ── AddStudentModal ──
  add_student_title:     { en: 'Add Student',              fil: 'Magdagdag ng Estudyante' },
  add_student_section:   { en: 'Section:',                 fil: 'Seksyon:' },
  add_student_name:      { en: 'Full Name',                fil: 'Buong Pangalan' },
  add_student_ph:        { en: 'e.g. Juan dela Cruz',      fil: 'hal. Juan dela Cruz' },

  // ── MigrationModal ──
  migrate_title:         { en: 'One-time Setup Needed',    fil: 'Kailangan ng Isang-beses na Setup' },
  migrate_desc:          { en: 'Some students and essays need a section or subject before you can continue.', fil: 'Ang ilang mga estudyante at sanaysay ay nangangailangan ng seksyon o paksa bago ka makapatuloy.' },
  migrate_assign_sections:{ en: 'Assign Students to a Section', fil: 'Italaga ang mga Estudyante sa Seksyon' },
  migrate_select_section:{ en: 'Select section…',          fil: 'Pumili ng seksyon…' },
  migrate_assign_subjects:{ en: 'Assign Essays to a Subject', fil: 'Italaga ang mga Sanaysay sa Paksa' },
  migrate_select_subject:{ en: 'Select subject…',          fil: 'Pumili ng paksa…' },
  migrate_save_continue: { en: 'Save & Continue →',        fil: 'I-save at Ituloy →' },
  migrate_assign_all:    { en: 'Assign all items to continue', fil: 'Italaga ang lahat ng aytem para ituloy' },

  // ── SubjectManager ──
  subj_manage_title:     { en: 'Manage Subjects',          fil: 'Pamahalaan ang mga Paksa' },
  subj_empty:            { en: 'No subjects yet. Add one below.', fil: 'Wala pang mga paksa. Magdagdag ng isa sa ibaba.' },
  subj_essay:            { en: 'essay',                    fil: 'sanaysay' },
  subj_essays:           { en: 'essays',                   fil: 'sanaysay' },
  subj_delete_title:     { en: 'Delete subject',           fil: 'Burahin ang paksa' },
  subj_delete_disabled:  { en: 'Add another subject before deleting this one', fil: 'Magdagdag ng isa pang paksa bago burahin ito' },
  subj_add_header:       { en: 'Add Subject',              fil: 'Magdagdag ng Paksa' },
  subj_name_ph:          { en: 'Subject name (e.g. English, AP, Math)', fil: 'Pangalan ng paksa (hal. English, AP, Math)' },
  subj_select_lang:      { en: 'Select grading language…', fil: 'Pumili ng wikang pang-marka…' },
  subj_add_btn:          { en: 'Add Subject',              fil: 'Magdagdag ng Paksa' },
  subj_delete_impossible:{ en: 'Add another subject first before deleting this one.', fil: 'Magdagdag muna ng isa pang paksa bago burahin ito.' },
  subj_delete_btn:       { en: 'Delete Subject',           fil: 'Burahin ang Paksa' },

  // ── General ──
  gen_loading:          { en: 'Loading…',              fil: 'Naglo-load…' },
  gen_error:            { en: 'Error',                 fil: 'Error' },
  gen_save:             { en: 'Save',                  fil: 'I-save' },
  gen_cancel:           { en: 'Cancel',                fil: 'Kanselahin' },
  gen_delete:           { en: 'Delete',                fil: 'Burahin' },
  gen_add:              { en: 'Add',                   fil: 'Magdagdag' },
  gen_close:            { en: 'Close',                 fil: 'Isara' },
  gen_english:          { en: 'English',               fil: 'Ingles' },
  gen_filipino:         { en: 'Filipino',              fil: 'Filipino' },
} satisfies Translations;

export type StringKey = keyof typeof STRINGS;

// ─── Resolve preference → lang ────────────────────────────────────────────────

function prefToLang(pref: UILanguagePreference): Lang {
  return pref === 'tagalog' ? 'fil' : 'en';
}

// ─── Translation function factory ─────────────────────────────────────────────

export function makeT(lang: Lang) {
  return function t(key: StringKey): string {
    return STRINGS[key][lang];
  };
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useT() {
  const [pref, setPref] = useState<UILanguagePreference>(getUILanguagePreference);

  useEffect(() => {
    return subscribeUILanguagePreferenceChange(() => setPref(getUILanguagePreference()));
  }, []);

  const lang = prefToLang(pref);
  return makeT(lang);
}
