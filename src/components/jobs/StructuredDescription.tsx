'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Briefcase, Target, Gift } from 'lucide-react';

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
        <CardHeader>
          <CardTitle className="text-lg">Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {originalContent}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Responsibilities */}
      {summaryBullets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              Key Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {summaryBullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      {requirementBullets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {requirementBullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-green-600 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Benefits */}
      {benefitBullets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {benefitBullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Show/Hide Original Description */}
      {originalContent && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showOriginal ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide full description
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show full description
              </>
            )}
          </Button>

          {showOriginal && (
            <Card className="mt-2 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Original Job Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
                  {originalContent}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
