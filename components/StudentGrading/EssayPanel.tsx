import React from 'react';
import { IoCloudUploadOutline, IoStar } from 'react-icons/io5';
import { Student, Subject } from './types';
import { ProficiencyLevel } from '../../types';

const profBadge: Record<string, string> = {
  [ProficiencyLevel.INDEPENDENT]:   'bg-green-100 text-green-700',
  [ProficiencyLevel.INSTRUCTIONAL]: 'bg-amber-100 text-amber-700',
  [ProficiencyLevel.FRUSTRATION]:   'bg-red-100 text-red-700',
};

interface EssayPanelProps {
  student: Student | null;
  selectedSubject: Subject | null;
  selectedEssayId: string | null;
  onSelectEssay: (essayId: string) => void;
  onUploadEssay: () => void;
}

export const EssayPanel: React.FC<EssayPanelProps> = ({
  student, selectedSubject, selectedEssayId, onSelectEssay, onUploadEssay,
}) => {
  const visible = !!student;

  const essays = student
    ? selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays
    : [];

  return (
    <div
      className={`flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        visible ? 'w-[210px]' : 'w-0'
      }`}
    >
      {student && (
        <>
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 bg-[#fafbff] flex-shrink-0">
            <div className="font-black text-xs text-gray-900 truncate">{student.name}</div>
            {selectedSubject && (
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                {selectedSubject.name} ·{' '}
                <span className={selectedSubject.language === 'english' ? 'text-blue-500' : 'text-pink-500'}>
                  {selectedSubject.language === 'english' ? '🇺🇸 English' : '🇵🇭 Filipino'}
                </span>
              </div>
            )}
          </div>

          {/* Essay list */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
              Essays (Sanaysay) · {essays.length}
            </div>
            {essays.length === 0 ? (
              <div className="text-center py-6 text-gray-300">
                <p className="text-xs">No essays yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {essays.map(essay => {
                  const prof = essay.diagnosisResult?.proficiency;
                  const isActive = selectedEssayId === essay.id;
                  return (
                    <button
                      key={essay.id}
                      onClick={() => onSelectEssay(essay.id)}
                      className={`w-full text-left p-2.5 border-2 rounded-lg transition-all ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-100 hover:border-indigo-200 bg-gray-50 hover:bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-gray-800 truncate mb-1">{essay.title}</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {prof && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${profBadge[prof] ?? 'bg-gray-100 text-gray-600'}`}>
                            {prof}
                          </span>
                        )}
                        {essay.diagnosisResult?.natScore !== undefined && (
                          <span className="text-[9px] text-gray-500">{essay.diagnosisResult.natScore}%</span>
                        )}
                        {essay.teacherRating ? (
                          <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                            <IoStar className="text-[9px]" />{essay.teacherRating}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1">
                        {new Date(essay.uploadedAt).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="p-2 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onUploadEssay}
              className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-xl text-[10px] font-bold transition-colors"
            >
              <IoCloudUploadOutline className="text-sm" />
              Upload for {student.name.split(' ')[0]}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
