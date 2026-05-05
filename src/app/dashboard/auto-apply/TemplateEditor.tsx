'use client';

import { useState } from 'react';

interface CoverLetterTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
}

interface ParsedProfile {
  name?: string;
  email?: string;
  skills?: string[];
  experience_years?: number;
  current_title?: string;
  field?: string;
  summary?: string;
}

interface TemplateEditorProps {
  initialTemplates: CoverLetterTemplate[];
  onTemplateCreated: (template: CoverLetterTemplate) => void;
  onTemplateDeleted: (id: string) => void;
  onResumeUploaded?: () => void;
}

const STYLES = [
  {
    id: 'professional',
    name: 'Professional',
    emoji: '👔',
    description: 'Formal tone, highlights qualifications and experience',
  },
  {
    id: 'casual',
    name: 'Casual & Friendly',
    emoji: '😊',
    description: 'Conversational tone, shows personality',
  },
  {
    id: 'concise',
    name: 'Short & Direct',
    emoji: '⚡',
    description: '3-4 sentences, gets straight to the point',
  },
];

export function TemplateEditor({
  initialTemplates,
  onTemplateCreated,
  onTemplateDeleted,
  onResumeUploaded,
}: TemplateEditorProps) {
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>(initialTemplates);
  const [loading, setLoading] = useState(false);

  // Resume state
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null);

  // LinkedIn state
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinProfile, setLinkedinProfile] = useState<{
    name?: string;
    headline?: string;
    about?: string;
    skills?: string[];
    experience?: { title: string; company: string; duration: string }[];
    location?: string;
  } | null>(null);

  // Style state
  const [selectedStyle, setSelectedStyle] = useState<string>(
    templates.length > 0 ? templates[0].name.toLowerCase() : ''
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max 5MB.');
      return;
    }

    setResumeUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/user/resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResumeFile(data.fileName);
        if (data.profile) {
          setParsedProfile(data.profile);
        }
        onResumeUploaded?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to upload resume');
      }
    } catch {
      alert('Failed to upload resume');
    } finally {
      setResumeUploading(false);
    }
  };

  const handleLinkedinScrape = async () => {
    if (!linkedinUrl.includes('linkedin.com')) {
      alert('Please enter a valid LinkedIn profile URL');
      return;
    }
    setLinkedinLoading(true);
    try {
      const res = await fetch('/api/user/linkedin-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl: linkedinUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedinProfile(data.profile);
        // Merge with parsed profile
        if (data.profile) {
          setParsedProfile(prev => ({
            ...prev,
            name: prev?.name || data.profile.name,
            current_title: prev?.current_title || data.profile.headline,
            summary: prev?.summary || data.profile.about,
            skills: [...new Set([...(prev?.skills || []), ...(data.profile.skills || [])])].slice(0, 15),
          }));
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to fetch LinkedIn profile');
      }
    } catch {
      alert('Failed to fetch LinkedIn profile');
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleSelectStyle = async (styleId: string) => {
    setSelectedStyle(styleId);
    setLoading(true);

    try {
      // Save as template with the style name
      const style = STYLES.find(s => s.id === styleId);
      const res = await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: style?.name || styleId,
          subject: 'Application: {{ job_title }} — {{ your_name }}',
          body: `[AI-generated ${styleId} cover letter based on resume and job description]`,
          isDefault: true,
        }),
      });

      if (res.ok) {
        const newTemplate = await res.json();
        setTemplates([newTemplate]);
        onTemplateCreated(newTemplate);
      }
    } catch (error) {
      console.error('Error saving style:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      // Generate a preview cover letter using AI
      const res = await fetch('/api/user/auto-apply/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: selectedStyle,
          jobTitle: 'Senior React Developer',
          companyName: 'Acme Corp',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewText(data.coverLetter || 'Preview not available');
      }
    } catch {
      setPreviewText('Could not generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Reset style preference?')) return;
    try {
      const res = await fetch(`/api/user/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== id));
        onTemplateDeleted(id);
        setSelectedStyle('');
      }
    } catch {}
  };

  const isSetupComplete = !!resumeFile && templates.length > 0;

  return (
    <div>
      {/* Step 1: Upload Resume */}
      <div className={`bg-white rounded-xl border-2 p-6 mb-4 ${!resumeFile ? 'border-orange-400 shadow-md' : 'border-green-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${resumeFile ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {resumeFile ? '✓' : '1'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-1">
              {resumeFile ? 'Resume Uploaded ✓' : 'Upload Your Resume'}
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              {resumeFile
                ? 'AI extracted your profile from the resume'
                : 'Upload PDF — AI will extract your skills, experience, and profile to write personalized cover letters.'}
            </p>

            {!resumeFile && !parsedProfile ? (
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  resumeUploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-black hover:bg-gray-50'
                }`}>
                  {resumeUploading ? (
                    <div>
                      <div className="w-8 h-8 border-2 border-gray-400 border-t-black rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Analyzing resume...</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">📄 Click to upload PDF</p>
                      <p className="text-xs text-gray-400 mt-1">Max 5MB</p>
                    </div>
                  )}
                </div>
                <input type="file" accept=".pdf" onChange={handleResumeUpload} disabled={resumeUploading} className="hidden" />
              </label>
            ) : (
              <div>
                {parsedProfile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {parsedProfile.name && <div><span className="text-green-600">Name:</span> <span className="font-medium">{parsedProfile.name}</span></div>}
                      {parsedProfile.current_title && <div><span className="text-green-600">Title:</span> {parsedProfile.current_title}</div>}
                      {parsedProfile.field && <div><span className="text-green-600">Field:</span> {parsedProfile.field}</div>}
                      {parsedProfile.experience_years && <div><span className="text-green-600">Exp:</span> {parsedProfile.experience_years} years</div>}
                    </div>
                    {parsedProfile.skills && parsedProfile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {parsedProfile.skills.slice(0, 8).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">{skill}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer">
                  Upload different resume
                  <input type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LinkedIn (optional enrichment) */}
      {resumeFile && (
        <div className="bg-white rounded-xl border p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg shrink-0">in</div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">
                {linkedinProfile ? 'LinkedIn Connected ✓' : 'Add LinkedIn (optional)'}
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                {linkedinProfile
                  ? `${linkedinProfile.headline || linkedinProfile.name} — ${linkedinProfile.skills?.length || 0} extra skills added`
                  : 'Enrich your profile with LinkedIn data — more skills, experience, and headline for better cover letters.'}
              </p>

              {!linkedinProfile ? (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/your-profile"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleLinkedinScrape}
                    disabled={linkedinLoading || !linkedinUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 shrink-0"
                  >
                    {linkedinLoading ? 'Fetching...' : 'Import'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {linkedinProfile.skills?.slice(0, 8).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Choose Style */}
      <div className={`bg-white rounded-xl border-2 p-6 mb-4 ${resumeFile && !templates.length ? 'border-orange-400 shadow-md' : templates.length > 0 ? 'border-green-200' : 'border-gray-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${templates.length > 0 ? 'bg-green-100 text-green-700' : resumeFile ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>
            {templates.length > 0 ? '✓' : '2'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-1">
              {templates.length > 0 ? `Style: ${templates[0].name} ✓` : 'Choose Cover Letter Style'}
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              {templates.length > 0
                ? 'AI will generate a unique cover letter in this style for each job'
                : 'Pick a tone — AI writes a unique cover letter for every job based on your resume.'}
            </p>

            {templates.length > 0 ? (
              <button onClick={() => handleDelete(templates[0].id)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Change style
              </button>
            ) : (
              <div className="space-y-2">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => handleSelectStyle(style.id)}
                    disabled={!resumeFile || loading}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      !resumeFile
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : selectedStyle === style.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-2xl">{style.emoji}</span>
                    <div className="flex-1">
                      <span className="font-medium">{style.name}</span>
                      <p className="text-xs text-gray-500">{style.description}</p>
                    </div>
                    {loading && selectedStyle === style.id ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-black rounded-full animate-spin" />
                    ) : (
                      <span className="text-gray-400">→</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete State */}
      {isSetupComplete && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-green-800 mb-1">Resume & Style Ready!</h3>
          <p className="text-sm text-green-700 mb-4">
            AI will write a unique <strong>{templates[0]?.name}</strong> cover letter for each job,
            using your skills and experience from the resume.
          </p>
          <p className="text-xs text-green-600">
            Next: Create an auto-apply loop in the &ldquo;My Loops&rdquo; tab to start applying automatically.
          </p>
        </div>
      )}
    </div>
  );
}
