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

const AVAILABLE_VARIABLES = [
  { key: '{{ job_title }}', description: 'The job title' },
  { key: '{{ company_name }}', description: 'Company name' },
  { key: '{{ your_name }}', description: 'Your full name' },
  { key: '{{ your_field }}', description: 'Your professional field' },
];

export function TemplateEditor({
  initialTemplates,
  onTemplateCreated,
  onTemplateDeleted,
}: TemplateEditorProps) {
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>(initialTemplates);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Application: {{ job_title }} - {{ your_name }}');
  const [body, setBody] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setName('');
    setSubject('Application: {{ job_title }} - {{ your_name }}');
    setBody('');
    setIsDefault(false);
    setShowPreview(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          body,
          isDefault,
        }),
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
    if (!confirm('Are you sure you want to delete this template?')) return;

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

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/user/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        setTemplates(
          templates.map((t) => ({
            ...t,
            isDefault: t.id === id,
          }))
        );
      }
    } catch (error) {
      console.error('Error setting default template:', error);
    }
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
      {/* Create button */}
      {!isCreating && (
        <button
          onClick={() => setIsCreating(true)}
          className="mb-6 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Create New Template
        </button>
      )}

      {/* Create form */}
      {isCreating && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Cover Letter Template</h2>

          {/* Available variables */}
          <div className="p-3 bg-gray-50 rounded-lg mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Available Variables:</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <span
                  key={v.key}
                  className="px-2 py-1 bg-white border text-xs rounded text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setBody((prev) => prev + v.key);
                  }}
                  title={v.description}
                >
                  {v.key}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Application: {{ job_title }} - {{ your_name }}"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cover Letter Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Dear Hiring Manager,&#10;&#10;I am writing to express my interest in the {{ job_title }} position at {{ company_name }}..."
                required
                rows={10}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
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
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                Set as default template
              </label>
            </div>

            {/* Preview toggle */}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>

            {showPreview && body && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview:</p>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Subject: {renderPreview(subject)}
                </p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap mt-2">
                  {renderPreview(body)}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !name || !body}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates list */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No templates yet
          </h2>
          <p className="text-gray-600 mb-6">
            Create a cover letter template to use with your auto-apply loops
          </p>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Create Your First Template
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-xl border p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    {template.isDefault && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                        Default
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                      {template.type.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Subject: {template.subject}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {template.body}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!template.isDefault && (
                    <button
                      onClick={() => handleSetDefault(template.id)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
