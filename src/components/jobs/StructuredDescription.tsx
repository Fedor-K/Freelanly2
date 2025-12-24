'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StructuredDescriptionProps {
  summaryBullets: string[];
  requirementBullets: string[];
  benefitBullets: string[];
  originalContent: string | null;
  showOriginalByDefault?: boolean;
}

export function StructuredDescription({
  summaryBullets,
  requirementBullets,
  benefitBullets,
  originalContent,
  showOriginalByDefault = false,
}: StructuredDescriptionProps) {
  const [showOriginal, setShowOriginal] = useState(showOriginalByDefault);

  const hasStructuredContent =
    summaryBullets.length > 0 ||
    requirementBullets.length > 0 ||
    benefitBullets.length > 0;

  // If no structured content, show original directly
  if (!hasStructuredContent) {
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

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Key Responsibilities */}
        {summaryBullets.length > 0 && (
          <div className="border-l-4 border-blue-500 bg-blue-50/50 p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <span className="text-lg">📋</span> What You'll Do
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

        {/* Requirements */}
        {requirementBullets.length > 0 && (
          <div className="border-l-4 border-green-500 bg-green-50/50 p-4">
            <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
              <span className="text-lg">🎯</span> What We're Looking For
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

        {/* Benefits */}
        {benefitBullets.length > 0 && (
          <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <span className="text-lg">🎁</span> What You'll Get
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
