import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";

export default function ConfidenceCard({ job }) {
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [showAllChecklist, setShowAllChecklist] = useState(false);

  const confidence = job.confidence_level || 'LOW';
  const reasons = job.confidence_reasons || [];
  const checklist = job.verify_checklist || [];
  const verifyNeeded = job.verify_needed !== false;

  const confidenceColors = {
    HIGH: 'bg-green-100 text-green-800 border-green-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    LOW: 'bg-red-100 text-red-800 border-red-300'
  };

  const confidenceIcons = {
    HIGH: <CheckCircle className="w-5 h-5" />,
    MEDIUM: <AlertTriangle className="w-5 h-5" />,
    LOW: <AlertTriangle className="w-5 h-5" />
  };

  const displayReasons = showAllReasons ? reasons : reasons.slice(0, 5);
  const displayChecklist = showAllChecklist ? checklist : checklist.slice(0, 5);

  return (
    <Card className="border-2">
      <CardHeader className="border-b bg-slate-50 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Compliance Confidence</CardTitle>
          <Badge className={`${confidenceColors[confidence]} border`}>
            {confidenceIcons[confidence]}
            <span className="ml-1">{confidence}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Verify Needed */}
        <div className="flex items-center justify-between p-3 rounded" 
             style={{ backgroundColor: verifyNeeded ? '#FEF3C7' : '#D1FAE5' }}>
          <span className="text-sm font-medium">Verify Needed:</span>
          <Badge className={verifyNeeded ? 'bg-amber-600' : 'bg-green-600'}>
            {verifyNeeded ? 'YES' : 'NO'}
          </Badge>
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Contributing Factors:</p>
            <ul className="list-disc pl-5 space-y-1">
              {displayReasons.map((reason, idx) => (
                <li key={idx} className="text-xs text-slate-600">{reason}</li>
              ))}
            </ul>
            {reasons.length > 5 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllReasons(!showAllReasons)}
                className="h-6 text-xs"
              >
                {showAllReasons ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show {reasons.length - 5} More
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Verify Checklist */}
        {checklist.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Verification Checklist:</p>
            <ul className="list-disc pl-5 space-y-1">
              {displayChecklist.map((item, idx) => (
                <li key={idx} className="text-xs text-slate-600">{item}</li>
              ))}
            </ul>
            {checklist.length > 5 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllChecklist(!showAllChecklist)}
                className="h-6 text-xs"
              >
                {showAllChecklist ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show {checklist.length - 5} More
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <Alert className="border-blue-500 bg-blue-50 mt-3">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs">
            <strong>Disclaimer:</strong> Confidence is based on available GIS data and user inputs. 
            It is not a legal determination or survey.
          </AlertDescription>
        </Alert>

        {job.confidence_last_updated_at && (
          <p className="text-xs text-slate-500 text-center">
            Last updated: {new Date(job.confidence_last_updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}