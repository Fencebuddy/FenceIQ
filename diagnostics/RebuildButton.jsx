/**
 * REBUILD GATES + MATERIALS BUTTON
 * Admin tool to regenerate versioned data
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { rebuildJobData } from './VersionedCleanup';

export default function RebuildButton({ jobId, onComplete }) {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [result, setResult] = useState(null);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setResult(null);
    
    try {
      const rebuildResult = await rebuildJobData(jobId);
      setResult(rebuildResult);
      
      if (rebuildResult.success && onComplete) {
        onComplete();
      }
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    }
    
    setIsRebuilding(false);
  };

  return (
    <Card className="border-emerald-500">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-600" />
          Rebuild Gates + Materials (Versioned)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-600">
          Generates new versions of gates and materials from map source of truth.
          Old versions become inert (no deletes needed).
        </p>
        
        <Button
          onClick={handleRebuild}
          disabled={isRebuilding}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {isRebuilding ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {isRebuilding ? 'Rebuilding...' : 'Rebuild Now'}
        </Button>

        {result && (
          <Card className={result.success ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}>
            <CardContent className="pt-4 space-y-2 text-xs">
              {result.success ? (
                <>
                  <div className="flex items-center gap-2 text-green-900">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-semibold">Rebuild Complete</span>
                  </div>
                  
                  {result.gates && (
                    <div className="pl-6 space-y-1 text-green-800">
                      <p><strong>Gates:</strong></p>
                      <p>• Version: <Badge variant="outline" className="text-xs">{result.gates.newVersion}</Badge></p>
                      <p>• Valid gates: {result.gates.gatesWritten}</p>
                      <p>• Orphans marked: {result.gates.orphansWritten}</p>
                    </div>
                  )}
                  
                  {result.materials && (
                    <div className="pl-6 space-y-1 text-green-800">
                      <p><strong>Materials:</strong></p>
                      <p>• Version: <Badge variant="outline" className="text-xs">{result.materials.newVersion}</Badge></p>
                      <p>• Line items: {result.materials.materialsWritten}</p>
                    </div>
                  )}
                  
                  <p className="text-green-700 font-semibold mt-2">
                    ✓ Refresh page to see clean data
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-red-900">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-semibold">Rebuild Failed</span>
                  </div>
                  <p className="text-red-800 pl-6">{result.error}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}