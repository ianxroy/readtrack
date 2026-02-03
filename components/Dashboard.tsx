
import React from 'react';
import { Analyzer } from './Analyzer';
import { CachedAnalysis } from '../types';

interface DashboardProps {
  referenceFiles?: { base64: string; mimeType: string; name: string }[];
    referenceFileName?: string;
  onSaveReference?: (name: string, files: { base64: string; mimeType: string; name: string }[]) => void;
    onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  selectedAnalysis?: CachedAnalysis | null;
    onMenuClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  referenceFiles, 
    referenceFileName, 
    onSaveReference,
    onSaveAnalysis,
  selectedAnalysis,
    onMenuClick 
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Analyzer 
          initialReferenceFiles={referenceFiles}
            referenceFileName={referenceFileName} 
            onSaveReference={onSaveReference}
            onSaveAnalysis={onSaveAnalysis}
          selectedAnalysis={selectedAnalysis}
            onMenuClick={onMenuClick}
        />
      </div>
    </div>
  );
};
