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

interface TemplateEditorProps {
  initialTemplates: CoverLetterTemplate[];
  onTemplateCreated: (template: CoverLetterTemplate) => void;
  onTemplateDeleted: (id: string) => void;
}

const STARTER_TEMPLATES = [
  {
    name: 'Professional',
    subject: 'Application: {{ job_title }} — {{ your_name }}',
    body: `Dear Hiring Manager,

I am writing to express my interest in the {{ job_title }} position at {{ company_name }}.

With my background in {{ your_field }}, I believe I can bring strong value to your team. I am particularly drawn to this role because it aligns with my experience and career goals.

I would welcome the opportunity to discuss how my skills can contribute to {{ company_name }}'s success. My resume is attached for your review.

Best regards,
{{ your_name }}`,
  },
  {
    name: 'Concise & Direct',
    subject: '{{ job_title }} — {{ your_name }}',
    body: `Hi,

I saw your {{ job_title }} opening at {{ company_name }} and I'm interested. I have relevant experience in {{ your_field }} and believe I'd be a great fit.

Resume attached. Happy to chat anytime.

{{ your_name }}`,
  },
  {
    name: 'Freelancer',
    subject: 'Re: {{ job_title }} — Available Immediately',
    body: `Hi,

I'm a {{ your_field }} professional, available immediately for your {{ job_title }} project at {{ company_name }}.

I've worked on similar projects and can start right away. Let me know if you'd like to discuss details — my resume is attached.

Best,
{{ your_name }}`,
  },
];

const AVAILABLE_VARIABLES = [
  { key: '{{ job_title }}', label: 'Job Title', example: 'Senior React Developer' },
  { key: '{{ company_name }}', label: 'Company', example: 'Acme Corp' },
  { key: '{{ your_name }}', label: 'Your Name', example: 'John Doe' },
  { key: '{{ your_field }}', label: 'Your Field', example: 'Frontend Development' },
];

export function TemplateEditor({
  initialTemplates,
  onTemplateCreated,
  onTemplateDeleted,
}: TemplateEditorProps) {
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>(initialTemplates);
  const [isCreating, setIsCreating] = useState(templates.length === 0);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Resume state
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeSaved, setResumeSaved] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDefault, setIsDefault] = useState(true);

  const resetForm = () => {
    setName('');
    setSubject('');
    setBody('');
    setIsDefault(true);
    setShowPreview(false);
  };

  const useStarterTemplate = (template: typeof STARTER_TEMPLATES[0]) => {
    setName(template.name);
    setSubject(template.subject);
    setBody(template.body);
    setIsCreating(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, body, isDefault }),
      });

      if (res.ok) {
        const newTemplate = await res.json();
        setTemplates([newTemplate, ...templates]);
        onTemplateCreated(newTemplate);
        setIsCreating(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/user/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== id));
        onTemplateDeleted(id);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleSaveResume = async () => {
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeUrl }),
      });
      if (res.ok) setResumeSaved(true);
    } catch {}
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/\{\{\s*job_title\s*\}\}/g, 'Senior React Developer')
      .replace(/\{\{\s*company_name\s*\}\}/g, 'Acme Corp')
      .replace(/\{\{\s*your_name\s*\}\}/g, 'John Doe')
      .replace(/\{\{\s*your_field\s*\}\}/g, 'Frontend Development');
  };

  return (
    <div>
      {/* Resume Upload Section */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Your Resume</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add a link to your resume. It will be included in every application.
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            value={resumeUrl}
            onChange={(e) => { setResumeUrl(e.target.value); setResumeSaved(false); }}
            placeholder="https://drive.google.com/... or https://yoursite.com/resume.pdf"
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveResume}
            disabled={!resumeUrl}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
          >
            {resumeSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Tip: Upload your resume to Google Drive, set sharing to &ldquo;Anyone with the link&rdquo;, and paste the link here.
        </p>
      </div>

      {/* Starter Templates — show when no templates exist */}
      {templates.length === 0 && !isCreating && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Choose a Starter Template</h2>
          <p className="text-sm text-gray-500 mb-4">
            Pick a template and customize it, or start from scratch.
          </p>
          <div className="space-y-3">
            {STARTER_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                onClick={() => useStarterTemplate(tmpl)}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{tmpl.name}</span>
                  <span className="text-xs text-gray-400">Click to use →</span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{tmpl.body.substring(0, 120)}...</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Or start from scratch
          </button>
        </div>
      )}

      {/* Create/Edit form */}
      {isCreating && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {name ? `Edit: ${name}` : 'Create Cover Letter Template'}
          </h2>

          {/* Variables info */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
            <p className="text-xs font-medium text-blue-700 mb-2">
              Click variables to insert them. AI will replace them with real data for each job:
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="px-2 py-1 bg-white border border-blue-200 text-xs rounded text-blue-700 hover:bg-blue-100 transition-colors"
                  onClick={() => setBody((prev) => prev + ' ' + v.key)}
                  title={`${v.label} — e.g. "${v.example}"`}
                >
                  {v.key} <span className="text-blue-400">= {v.example}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Professional, Casual, Technical"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Application: {{ job_title }} — {{ your_name }}"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your cover letter template here..."
                required
                rows={12}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default template</label>
            </div>

            {/* Preview */}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>

            {showPreview && body && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-xs font-medium text-gray-400 mb-2">Preview (with example data):</p>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Subject: {renderPreview(subject)}
                </p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap border-t pt-2">
                  {renderPreview(body)}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !name || !body || !subject}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); resetForm(); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing templates */}
      {templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Templates</h2>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                + New Template
              </button>
            )}
          </div>
          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      {template.isDefault && (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Default</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Subject: {template.subject}</p>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.body}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
