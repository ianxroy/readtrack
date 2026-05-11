import React, { useState, useRef, useEffect } from "react";
import {
  IoCloseOutline,
  IoCloudUploadOutline,
  IoChevronUpOutline,
  IoChevronDownOutline,
  IoTrashOutline,
  IoAddOutline,
} from "react-icons/io5";
import { Student, Subject, Section } from "./types";
import { OriginalFile } from "../../types";
import {
  extractTextFromImageAPI,
  ingestReferenceAPI,
} from "../../services/pythonService";
import { useT } from "../../services/i18n";
import mammoth from "mammoth";

interface UploadModalProps {
  students: Student[];
  sections: Section[];
  subjects: Subject[];
  prefilledSectionId?: string;
  prefilledStudentId?: string;
  prefilledSubjectId?: string;
  prefilledText?: string;
  onUpload: (params: {
    studentId: string;
    subjectId: string;
    title: string;
    text: string;
    originalFiles?: OriginalFile[];
  }) => Promise<void>;
  onAddSection?: (section: Section) => void;
  onAddSubject?: (subject: Subject) => void;
  onAddStudent?: (student: { name: string; sectionId: string }) => string;
  onClose: () => void;
}

const labelClass =
  "block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5";
const inputClass =
  "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all placeholder:text-slate-300 appearance-none";
const inlineInputClass =
  "flex-1 px-3 py-2 bg-slate-50 border border-indigo-300 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 transition-all placeholder:text-slate-400";
const addLinkClass =
  "text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 transition-colors";
const inlineAddBtnClass =
  "px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-colors";

export const UploadModal: React.FC<UploadModalProps> = ({
  students,
  sections,
  subjects,
  prefilledSectionId,
  prefilledStudentId,
  prefilledSubjectId,
  prefilledText,
  onUpload,
  onAddSection,
  onAddSubject,
  onAddStudent,
  onClose,
}) => {
  const t = useT();

  const initialSectionId =
    prefilledSectionId ??
    (prefilledStudentId
      ? students.find((s) => s.id === prefilledStudentId)?.sectionId
      : "") ??
    "";
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [studentId, setStudentId] = useState(prefilledStudentId ?? "");
  const [subjectId, setSubjectId] = useState(prefilledSubjectId ?? "");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<OriginalFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<OriginalFile | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectLang, setNewSubjectLang] = useState<"english" | "filipino">(
    "filipino",
  );
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [analyzeStepIndex, setAnalyzeStepIndex] = useState(0);

  const analyzeSteps = [
    t("upload_step_1"),
    t("upload_step_2"),
    t("upload_step_3"),
    t("upload_step_4"),
  ];

  const handleCreateSection = () => {
    const name = newSectionName.trim();
    if (!name || !onAddSection) return;
    const section: Section = { id: Date.now().toString(), name };
    onAddSection(section);
    setNewSectionName("");
    setShowNewSection(false);
  };

  const handleCreateSubject = () => {
    const name = newSubjectName.trim();
    if (!name || !onAddSubject) return;
    const subject: Subject = {
      id: Date.now().toString(),
      name,
      language: newSubjectLang,
    };
    onAddSubject(subject);
    setSubjectId(subject.id);
    setNewSubjectName("");
    setShowNewSubject(false);
  };

  const handleCreateStudent = () => {
    const name = newStudentName.trim();
    if (!name || !sectionId || !onAddStudent) return;
    const newId = onAddStudent({ name, sectionId });
    if (newId) setStudentId(newId);
    setNewStudentName("");
    setShowNewStudent(false);
  };

  useEffect(() => {
    setStudentId(prefilledStudentId ?? "");
  }, [prefilledStudentId]);
  useEffect(() => {
    if (prefilledSectionId) {
      setSectionId(prefilledSectionId);
      return;
    }
    if (prefilledStudentId) {
      const student = students.find((s) => s.id === prefilledStudentId);
      if (student?.sectionId) setSectionId(student.sectionId);
    }
  }, [prefilledSectionId, prefilledStudentId, students]);
  useEffect(() => {
    setSubjectId(prefilledSubjectId ?? "");
  }, [prefilledSubjectId]);
  useEffect(() => {
    if (prefilledText) setText(prefilledText);
  }, [prefilledText]);
  useEffect(() => {
    if (!isUploading) {
      setAnalyzeStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAnalyzeStepIndex((prev) => (prev + 1) % analyzeSteps.length);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [isUploading]);

  const canSubmit =
    !!studentId &&
    !!subjectId &&
    (!!text.trim() || imageFiles.length > 0) &&
    !isUploading &&
    !isExtracting;
  const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const resolveTitleAndBody = async (
    extractedText: string,
    fallbackTitle: string,
  ): Promise<{ title: string; bodyText: string }> => {
    let nextTitle = fallbackTitle;
    let nextBodyText = extractedText;
    console.log(
      "LOG 1: Entering resolveTitleAndBody. Fallback provided:",
      fallbackTitle,
    );

    try {
      const ingestResult = await ingestReferenceAPI({ text: extractedText });
      console.log("LOG 2: ingestReferenceAPI response:", ingestResult);

      const candidate = ingestResult?.title?.trim();
      const cleanedText = ingestResult?.text?.trim();

      if (candidate) {
        console.log(
          "LOG 3: Overwriting title with Ingest candidate:",
          candidate,
        );
        nextTitle = candidate;
      }
      if (cleanedText) nextBodyText = cleanedText;
    } catch (err) {
      console.log("LOG 4: Ingest API failed, keeping fallbacks.");
    }

    return { title: nextTitle, bodyText: nextBodyText };
  };
  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError(t("upload_err_size"));
      return;
    }
    setError(null);
    const fallbackTitle =
      file.name.replace(/\.[^.]+$/, "").trim() || "Untitled Essay";

    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const extractedText = (e.target?.result as string) || "";
        const { title: nextTitle, bodyText } = await resolveTitleAndBody(
          extractedText,
          fallbackTitle,
        );
        setText(bodyText);
        setTitle((prev) => prev.trim() || nextTitle);
      };
      reader.readAsText(file);
    } else if (
      file.type === DOCX_MIME ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const extracted = result.value.trim();
        if (extracted) {
          const { title: nextTitle, bodyText } = await resolveTitleAndBody(
            extracted,
            fallbackTitle,
          );
          setText(bodyText);
          setTitle((prev) => prev.trim() || nextTitle);
        } else {
          setError(t("upload_err_docx"));
        }
      } catch {
        setError(t("upload_err_docx_fail"));
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        setImageFiles((prev) => [
          ...prev,
          { base64, mimeType: file.type, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanImages = async () => {
    // 1. Guard clauses for early exit
    if (imageFiles.length === 0 || isExtracting) return;

    setIsExtracting(true);
    setError(null);
    setText("");

    for (const img of imageFiles) {
      try {
        const extracted = await extractTextFromImageAPI(
          img.base64,
          img.mimeType,
        );
        console.log("LOG 5: Raw Gemini API Response:", extracted);
        const errorData = extracted as any;

        // 2. Handle known errors using early returns
        if (
          errorData?.error === "api_key_invalid" ||
          errorData?.error === "project_denied"
        ) {
          setError(t("upload_err_scanner"));
          break;
        }
        if (errorData?.error === "no_api_key") {
          setError(t("upload_err_no_setup"));
          break;
        }
        if (errorData?.error === "ocr_timeout") {
          setError(
            `Reading "${img.name}" took too long. Try a smaller image or paste text.`,
          );
          break;
        }
        if (errorData?.error === "ocr_unavailable") {
          setError(t("upload_err_ocr_unavail"));
          break;
        }
        if (errorData?.error === "invalid_base64") {
          setError(`Could not read "${img.name}". Please re-upload.`);
          break;
        }

        // 3. Process successful data
        if (extracted?.text) {
          // 1. Capture the high-quality results from Gemini
          const geminiTitle = (extracted as any).title?.trim();
          const geminiText = extracted.text;

          const fallbackFileName = img.name.replace(/\.[^.]+$/, "").trim();

          // 2. Run the resolver to get the cleaned text
          const { bodyText } = await resolveTitleAndBody(
            geminiText,
            geminiTitle || fallbackFileName,
          );

          // 3. THE FIX: If Gemini successfully found a title, trust its raw text.
          // This prevents the ingest API from cutting off your first sentence.
          const finalBody =
            geminiTitle && geminiTitle !== "Untitled Document"
              ? geminiText
              : bodyText;

          setText((prev) =>
            prev.trim() ? prev + "\n\n" + finalBody : finalBody,
          );

          // 4. Ensure Gemini's title is used as the priority
          setTitle(geminiTitle || fallbackFileName);

          if (extracted?.warning) setError(extracted.warning);
        }
      } catch (err) {
        console.error("Non-fatal error during image scan:", err);
      }
    }

    setIsExtracting(false);
  };
  const handleFilesSequentially = async (files: File[]) => {
    for (const file of files) await handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSequentially(files);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setImageFiles((prev) => {
      const n = [...prev];
      [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
      return n;
    });
  };
  const moveDown = (idx: number) => {
    setImageFiles((prev) => {
      if (idx >= prev.length - 1) return prev;
      const n = [...prev];
      [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
      return n;
    });
  };
  const removeImage = (idx: number) =>
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDragStart = (idx: number) => {
    dragIndexRef.current = idx;
    setDraggingIndex(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
    setDragOverIndex(idx);
  };
  const handleImageDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null && from !== idx) {
      setImageFiles((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(idx, 0, item);
        return next;
      });
    }
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload({
        studentId,
        subjectId,
        title: title.trim() || "Untitled Essay",
        text: text.trim(),
        originalFiles: imageFiles.length > 0 ? imageFiles : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? t("upload_err_failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const studentsBySection = sections
    .map((sec) => ({
      section: sec,
      students: students.filter((s) => s.sectionId === sec.id),
    }))
    .filter((g) => g.students.length > 0);

  const filteredStudents = sectionId
    ? students.filter((s) => s.sectionId === sectionId)
    : students;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] relative overflow-hidden"
        aria-busy={isUploading}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {t("upload_grade_essay")}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {t("upload_instant_analysis")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
              isDragging
                ? "border-teal-400 bg-teal-50"
                : "border-slate-200 hover:border-teal-300 bg-slate-50/60"
            }`}
            onDragEnter={() => setIsDragging(true)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.docx,image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFilesSequentially(files);
                e.target.value = "";
              }}
            />
            {isExtracting ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                <div className="text-center">
                  <div className="text-xs font-bold text-teal-600">
                    {t("upload_extracting")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("upload_reading_image")}
                  </div>
                </div>
              </>
            ) : (
              <>
                <IoCloudUploadOutline
                  className={`text-2xl ${isDragging ? "text-teal-500" : "text-slate-300"}`}
                />
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-600">
                    {imageFiles.length > 0
                      ? t("upload_drag_more")
                      : t("upload_drag_file")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("upload_file_types")}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Image queue */}
          {imageFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {t("upload_images_label")} ({imageFiles.length}) —{" "}
                {t("upload_drag_reorder")}
              </div>
              {imageFiles.map((f, i) => (
                <React.Fragment key={i}>
                  {dragOverIndex === i &&
                    draggingIndex !== null &&
                    draggingIndex > i && (
                      <div className="h-0.5 rounded-full bg-teal-400 mx-1" />
                    )}
                  <div
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleImageDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing transition-all ${
                      draggingIndex === i
                        ? "opacity-40 bg-slate-100 border-slate-300 scale-[0.98]"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <span className="w-5 text-[10px] font-bold text-slate-400 text-center shrink-0">
                      {i + 1}
                    </span>
                    <img
                      src={`data:${f.mimeType};base64,${f.base64}`}
                      alt={f.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(f);
                      }}
                      className="w-8 h-8 object-cover rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span
                      onClick={() => setPreviewImage(f)}
                      className="text-xs text-slate-700 flex-1 truncate cursor-pointer hover:text-teal-600"
                    >
                      {f.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveUp(i);
                      }}
                      disabled={i === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors"
                    >
                      <IoChevronUpOutline className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveDown(i);
                      }}
                      disabled={i === imageFiles.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors"
                    >
                      <IoChevronDownOutline className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      className="p-1 rounded text-rose-400 hover:text-rose-600 transition-colors"
                    >
                      <IoTrashOutline className="text-sm" />
                    </button>
                  </div>
                  {dragOverIndex === i &&
                    draggingIndex !== null &&
                    draggingIndex < i && (
                      <div className="h-0.5 rounded-full bg-teal-400 mx-1" />
                    )}
                </React.Fragment>
              ))}
              <button
                onClick={handleScanImages}
                disabled={isExtracting}
                className="w-full mt-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                    {t("upload_scanning")}
                  </>
                ) : (
                  `${t("upload_scan")} ${imageFiles.length} ${imageFiles.length > 1 ? t("upload_images_plur") : t("upload_image_sing")}`
                )}
              </button>
            </div>
          )}

          {/* Image preview lightbox */}
          {previewImage && (
            <div
              className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div
                className="relative max-w-3xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-10 right-0 text-white/70 hover:text-white"
                >
                  <IoCloseOutline className="text-3xl" />
                </button>
                <img
                  src={`data:${previewImage.mimeType};base64,${previewImage.base64}`}
                  alt={previewImage.name}
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="text-center text-white/60 text-xs mt-2">
                  {previewImage.name}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 text-rose-600 text-xs font-semibold px-3 py-2.5 rounded-xl border border-rose-100">
              {error}
            </div>
          )}

          {/* Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>{t("upload_section")}</label>
              {onAddSection && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSection((s) => !s);
                    setNewSectionName("");
                  }}
                  className={addLinkClass}
                >
                  <IoAddOutline /> {t("upload_new")}
                </button>
              )}
            </div>
            {showNewSection && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  className={inlineInputClass}
                  placeholder={t("sidebar_section_ph")}
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSection();
                    if (e.key === "Escape") setShowNewSection(false);
                  }}
                />
                <button
                  onClick={handleCreateSection}
                  disabled={!newSectionName.trim()}
                  className={inlineAddBtnClass}
                >
                  {t("gen_add")}
                </button>
              </div>
            )}
            <select
              className={inputClass}
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setStudentId("");
              }}
            >
              <option value="">{t("upload_all_sections")}</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>{t("upload_student")}</label>
              {onAddStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewStudent((s) => !s);
                    setNewStudentName("");
                    if (!sectionId && sections.length > 0)
                      setSectionId(sections[0].id);
                  }}
                  className={addLinkClass}
                >
                  <IoAddOutline /> {t("upload_new")}
                </button>
              )}
            </div>
            {showNewStudent && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  className={inlineInputClass}
                  placeholder={
                    sectionId ? t("upload_student_ph") : t("upload_sec_first")
                  }
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateStudent();
                    if (e.key === "Escape") setShowNewStudent(false);
                  }}
                />
                <button
                  onClick={handleCreateStudent}
                  disabled={!newStudentName.trim() || !sectionId}
                  className={inlineAddBtnClass}
                >
                  {t("gen_add")}
                </button>
              </div>
            )}
            <select
              className={inputClass}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">{t("upload_select_student")}</option>
              {sectionId
                ? filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                : studentsBySection.map(({ section, students: ss }) => (
                    <optgroup key={section.id} label={section.name}>
                      {ss.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>{t("upload_subject")}</label>
              {onAddSubject && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSubject((s) => !s);
                    setNewSubjectName("");
                  }}
                  className={addLinkClass}
                >
                  <IoAddOutline /> {t("upload_new")}
                </button>
              )}
            </div>
            {showNewSubject && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  className={inlineInputClass}
                  placeholder={t("upload_subject_ph")}
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubject();
                    if (e.key === "Escape") setShowNewSubject(false);
                  }}
                />
                <button
                  onClick={() =>
                    setNewSubjectLang((l) =>
                      l === "english" ? "filipino" : "english",
                    )
                  }
                  className="px-2 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors whitespace-nowrap"
                >
                  {newSubjectLang === "english" ? "EN" : "FIL"}
                </button>
                <button
                  onClick={handleCreateSubject}
                  disabled={!newSubjectName.trim()}
                  className={inlineAddBtnClass}
                >
                  {t("gen_add")}
                </button>
              </div>
            )}
            <select
              className={inputClass}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">{t("upload_select_subject")}</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.language === "english" ? "EN" : "FIL"})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>{t("upload_title_opt")}</label>
            <input
              className={inputClass}
              placeholder={t("upload_title_ph")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Text */}
          <div>
            <label className={labelClass}>{t("upload_essay_content")}</label>
            <textarea
              className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all resize-none min-h-[120px] placeholder:text-slate-300"
              placeholder={t("upload_essay_ph")}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                {t("upload_analyzing")}
              </>
            ) : (
              t("upload_analyze_grade")
            )}
          </button>
        </div>

        {/* Analyzing overlay */}
        {isUploading && (
          <div className="absolute inset-0 z-10 bg-white/96 backdrop-blur-[1px] rounded-2xl p-6 flex flex-col">
            <div className="border border-indigo-100 bg-indigo-50 rounded-2xl px-4 py-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                <span className="text-[11px] font-black text-indigo-700 uppercase tracking-widest">
                  {t("upload_analyzing_title")}
                </span>
              </div>
              <div className="text-xs text-indigo-800 font-medium">
                {analyzeSteps[analyzeStepIndex]}
              </div>
              <div className="text-[10px] text-indigo-500 mt-1">
                {t("upload_analysis_wait")}
              </div>
            </div>
            <div className="space-y-3 opacity-40">
              <div className="h-3 w-32 bg-slate-200 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
              <div className="h-3 w-24 bg-slate-200 rounded mt-2" />
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
              <div className="h-3 w-28 bg-slate-200 rounded mt-2" />
              <div className="h-24 w-full bg-slate-100 rounded-xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
