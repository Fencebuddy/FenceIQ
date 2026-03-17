import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

export default function PipAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="px-4 mb-4 space-y-2">
      {alerts.map((alert, i) => {
        const isWarn = alert.severity === "WARN";
        return (
          <Alert key={i} className={`${isWarn ? "border-amber-300 bg-amber-50" : "border-blue-300 bg-blue-50"}`}>
            {isWarn ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <Info className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription className={`${isWarn ? "text-amber-800" : "text-blue-800"} text-sm font-medium ml-2`}>
              {alert.message}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}