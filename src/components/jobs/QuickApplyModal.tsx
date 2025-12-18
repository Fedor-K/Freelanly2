'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Mail, Paperclip } from 'lucide-react';

interface QuickApplyModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

export function QuickApplyModal({
  open,
  onClose,
  email,
  jobTitle,
  companyName,
  jobDescription,
}: QuickApplyModalProps) {
  const [coverLetter, setCoverLetter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  async function generateCoverLetter() {
    setGenerating(true);
    // TODO: Implement AI cover letter generation with DeepSeek
    // For now, just show a placeholder
    setTimeout(() => {
      setCoverLetter(`Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at ${companyName}.

[This is a placeholder. AI-generated cover letter feature coming soon!]

I would welcome the opportunity to discuss how my skills and experience align with your needs.

Best regards`);
      setGenerating(false);
    }, 1500);
  }

  function handleSubmit() {
    // TODO: Implement email sending functionality
    // For now, open mailto: as fallback
    const subject = encodeURIComponent(`Application for ${jobTitle} position`);
    const body = encodeURIComponent(coverLetter);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Apply - {jobTitle}</DialogTitle>
          <DialogDescription>
            Send your application to {companyName} at {email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cover Letter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="coverLetter">Cover Letter</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateCoverLetter}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </div>
            <Textarea
              id="coverLetter"
              placeholder="Write your cover letter or click 'Generate with AI' to create one automatically..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {/* Resume Upload */}
          <div className="space-y-2">
            <Label htmlFor="resume">Resume (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {resumeFile && (
                <span className="text-sm text-muted-foreground flex items-center">
                  <Paperclip className="h-4 w-4 mr-1" />
                  {resumeFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, or DOCX. Note: File attachment requires email client integration (coming soon).
            </p>
          </div>

          {/* Email Settings Placeholder */}
          <div className="rounded-lg border border-dashed p-4 bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>
                Send from your own email address - <strong>Coming soon</strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Connect your email to send applications directly without leaving the site.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!coverLetter.trim()}>
            <Mail className="h-4 w-4 mr-2" />
            Open in Email Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
