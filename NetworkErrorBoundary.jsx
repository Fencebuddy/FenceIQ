import React from 'react';
import { AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NetworkErrorBoundary({ children, onRetry }) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setHasError(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setHasError(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline || hasError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              {!isOnline ? (
                <Wifi className="w-16 h-16 text-red-400" />
              ) : (
                <AlertCircle className="w-16 h-16 text-amber-400" />
              )}
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">
                {!isOnline ? 'No Internet Connection' : 'Connection Error'}
              </h2>
              <p className="text-sm text-slate-400">
                {!isOnline 
                  ? 'Please check your internet connection and try again.'
                  : 'Unable to connect to the server. Please check your connection.'}
              </p>
            </div>

            <Button 
              onClick={() => {
                setHasError(false);
                onRetry?.();
                window.location.reload();
              }}
              variant="teal"
              size="lg"
              className="w-full"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Retry Connection
            </Button>

            {!isOnline && (
              <p className="text-xs text-slate-500 mt-4">
                Your work is saved locally. Changes will sync when connection is restored.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}