'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StructuredDescriptionProps {
  cleanDescription: string | null;
  originalContent: string | null;
  showOriginalByDefault?: boolean;
  // Legacy bullet props (for backwards compatibility)
  summaryBullets?: string[];
  requirementBullets?: string[];
  benefitBullets?: string[];
}

// Check if content is a placeholder (should be hidden)
function isPlaceholderContent(content: string[]): boolean {
  if (content.length === 0) return true;
  if (content.length === 1) {
    const text = content[0].toLowerCase();
    return text.includes('not specified') ||
           text.includes('not mentioned') ||
           text.includes('none mentioned') ||
           text.includes('n/a') ||
           text === 'none' ||
           text === 'not available';
  }
  return false;
}

// Parse cleanDescription text into styled sections
function parseCleanDescription(text: string) {
  const sections: { title: string; content: string[] }[] = [];
  const lines = text.split('\n');

  let currentSection: { title: string; content: string[] } | null = null;
  let introContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is a section header (no bullet prefix, followed by bullet lines or content)
    const isHeader = !trimmed.startsWith('•') &&
                     !trimmed.startsWith('-') &&
                     !trimmed.startsWith('*') &&
                     (trimmed.toLowerCase().includes('responsibilities') ||
                      trimmed.toLowerCase().includes('requirements') ||
                      trimmed.toLowerCase().includes('qualifications') ||
                      trimmed.toLowerCase().includes('benefits') ||
                      trimmed.toLowerCase().includes('about the role') ||
                      trimmed.toLowerCase().includes('what you') ||
                      trimmed.toLowerCase().includes('who you') ||
                      trimmed.toLowerCase().includes('your role') ||
                      trimmed.toLowerCase().includes('the role') ||
                      trimmed.toLowerCase().includes('what we'));

    if (isHeader) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { title: trimmed, content: [] };
    } else if (currentSection) {
      // Remove bullet prefix for consistent styling
      const content = trimmed.replace(/^[•\-\*]\s*/, '');
      currentSection.content.push(content);
    } else {
      // Content before any section header (intro paragraph)
      introContent.push(trimmed);
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Filter out sections with placeholder content
  const filteredSections = sections.filter(s => !isPlaceholderContent(s.content));

  return { introContent, sections: filteredSections };
}

// Get section styling based on title
function getSectionStyle(title: string) {
  const lower = title.toLowerCase();

  if (lower.includes('responsibilit') || lower.includes('what you') || lower.includes('your role') || lower.includes('the role') || lower.includes('you will')) {
    return {
      border: 'border-l-4 border-blue-500',
      bg: 'bg-blue-50/50',
      titleColor: 'text-blue-900',
      bulletColor: 'text-blue-500',
      bullet: '→'
    };
  }

  if (lower.includes('requirement') || lower.includes('qualifi') || lower.includes('who you') || lower.includes('looking for') || lower.includes('you have') || lower.includes('you need')) {
    return {
      border: 'border-l-4 border-green-500',
      bg: 'bg-green-50/50',
      titleColor: 'text-green-900',
      bulletColor: 'text-green-500',
      bullet: '✓'
    };
  }

  if (lower.includes('benefit') || lower.includes('offer') || lower.includes('perks') || lower.includes('you get') || lower.includes('we offer')) {
    return {
      border: 'border-l-4 border-purple-500',
      bg: 'bg-purple-50/50',
      titleColor: 'text-purple-900',
      bulletColor: 'text-purple-500',
      bullet: '★'
    };
  }

  // Default (about the role, intro)
  return {
    border: 'border-l-4 border-gray-300',
    bg: 'bg-gray-50/50',
    titleColor: 'text-gray-900',
    bulletColor: 'text-gray-500',
    bullet: '•'
  };
}

export function StructuredDescription({
  cleanDescription,
  originalContent,
  showOriginalByDefault = false,
  summaryBullets = [],
  requirementBullets = [],
  benefitBullets = [],
}: StructuredDescriptionProps) {
  const [showOriginal, setShowOriginal] = useState(showOriginalByDefault);

  const hasCleanDescription = cleanDescription && cleanDescription.trim().length > 0;
  const hasLegacyBullets = summaryBullets.length > 0 || requirementBullets.length > 0 || benefitBullets.length > 0;

  // If no structured content at all, show original directly
  if (!hasCleanDescription && !hasLegacyBullets) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {originalContent}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse clean description into sections
  const parsed = hasCleanDescription ? parseCleanDescription(cleanDescription) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {hasCleanDescription && parsed ? (
          <>
            {/* Intro paragraph (About the Role) */}
            {parsed.introContent.length > 0 && (
              <div className="p-4 border-b">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {parsed.introContent.join(' ')}
                </p>
              </div>
            )}

            {/* Sections */}
            {parsed.sections.map((section, index) => {
              const style = getSectionStyle(section.title);
              const isList = section.content.length > 1 ||
                           section.content.some(c => c.length < 100);

              return (
                <div key={index} className={`${style.border} ${style.bg} p-4`}>
                  <h3 className={`font-semibold ${style.titleColor} mb-2`}>
                    {section.title}
                  </h3>
                  {isList ? (
                    <ul className="space-y-1.5">
                      {section.content.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className={`${style.bulletColor} flex-shrink-0`}>
                            {style.bullet}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {section.content.join(' ')}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* Legacy bullet format fallback */
          <>
            {summaryBullets.length > 0 && (
              <div className="border-l-4 border-blue-500 bg-blue-50/50 p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Key Responsibilities
                </h3>
                <ul className="space-y-1.5">
                  {summaryBullets.map((bullet, index) => (
                    <li key={index} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-500 flex-shrink-0">→</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirementBullets.length > 0 && (
              <div className="border-l-4 border-green-500 bg-green-50/50 p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  Requirements
                </h3>
                <ul className="space-y-1.5">
                  {requirementBullets.map((bullet, index) => (
                    <li key={index} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {benefitBullets.length > 0 && (
              <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4">
                <h3 className="font-semibold text-purple-900 mb-2">
                  Benefits
                </h3>
                <ul className="space-y-1.5">
                  {benefitBullets.map((bullet, index) => (
                    <li key={index} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-purple-500 flex-shrink-0">★</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Show/Hide Original Description */}
        {originalContent && (
          <div className="border-t bg-gray-50/50 p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-muted-foreground hover:text-foreground w-full justify-center"
            >
              {showOriginal ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide original post
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show original post
                </>
              )}
            </Button>

            {showOriginal && (
              <div className="mt-3 p-3 bg-white rounded border text-sm text-muted-foreground whitespace-pre-wrap">
                {originalContent}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
