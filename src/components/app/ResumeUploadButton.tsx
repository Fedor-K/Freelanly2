'use client';

import { useState, useRef } from 'react';

export function ResumeUploadButton() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/user/resume', { method: 'POST', body: formData });
      if (res.ok) {
        setResult('Resume uploaded and parsed!');
      } else {
        const data = await res.json();
        setResult(data.error || 'Upload failed');
      }
    } catch {
      setResult('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx"
        hidden
        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <button
        className="btn btn-soft btn-sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload new resume'}
      </button>
      {result && (
        <span style={{ fontSize: '12px', color: result.includes('!') ? '#047857' : '#B91C1C' }}>
          {result}
        </span>
      )}
    </div>
  );
}
