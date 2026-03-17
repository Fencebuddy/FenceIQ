import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  MapPin, 
  RefreshCw, 
  ZoomIn, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Info
} from "lucide-react";
import { geocodeAddress, queryParcelAtPoint } from "./parcelService";

export default function ParcelPanel({ 
  job, 
  jobId,
  onZoomToParcel,
  showParcelOverlay,
  onToggleParcelOverlay
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const updateJobMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['job', jobId]);
    }
  });

  const fetchParcel = async (force = false) => {
    // Check if we should skip fetch
    if (!force && job.parcel_geojson && job.parcel_last_fetched_at) {
      const lastFetch = new Date(job.parcel_last_fetched_at);
      const daysSince = (Date.now() - lastFetch.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSince < 30) {
        return; // Cache is still valid
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Build full address
      const addressFull = job.address_full || 
        `${job.addressLine1}, ${job.city}, ${job.state} ${job.zip}`;

      // Step 1: Geocode
      const geocodeResult = await geocodeAddress(addressFull);
      
      if (!geocodeResult.success) {
        setError('Could not geocode address. Verify address is correct.');
        updateJobMutation.mutate({
          parcel_fetch_status: 'ERROR',
          address_full: addressFull
        });
        setLoading(false);
        return;
      }

      const { lat, lng, county } = geocodeResult;

      // Update job with geocoded data
      await updateJobMutation.mutateAsync({
        address_full: addressFull,
        address_lat: lat,
        address_lng: lng,
        county_detected: county
      });

      // Step 2: Fetch parcel services
      const services = await base44.entities.CountyParcelService.filter({
        is_active: true
      });

      // Determine which county to try
      const countyName = job.county || county || 'Kent';
      const countyService = services.find(s => s.county === countyName);

      if (!countyService) {
        setError(`No parcel service available for ${countyName} County.`);
        updateJobMutation.mutate({
          parcel_fetch_status: 'MANUAL_REQUIRED'
        });
        setLoading(false);
        return;
      }

      // Step 3: Query parcel
      const parcelResult = await queryParcelAtPoint(countyService, lat, lng);

      if (!parcelResult.success) {
        setError('Parcel not found at this location. You can draw property lines manually.');
        updateJobMutation.mutate({
          parcel_fetch_status: 'NOT_FOUND',
          parcel_last_fetched_at: new Date().toISOString()
        });
        setLoading(false);
        return;
      }

      // Step 4: Save parcel data
      await updateJobMutation.mutateAsync({
        parcel_geojson: parcelResult.geojson,
        parcel_bbox: parcelResult.bbox,
        parcel_id: parcelResult.parcelId,
        parcel_source: `${countyName}-ArcGIS`,
        parcel_fetch_status: 'OK',
        parcel_last_fetched_at: new Date().toISOString()
      });

      if (parcelResult.multipleFound) {
        setError('Multiple parcels found - showing smallest one. Verify boundary.');
      }

      setLoading(false);
    } catch (err) {
      console.error('Parcel fetch error:', err);
      setError('Failed to load parcel data. You can still draw manually.');
      updateJobMutation.mutate({
        parcel_fetch_status: 'ERROR'
      });
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchParcel(true);
  };

  const statusBadge = () => {
    switch (job.parcel_fetch_status) {
      case 'OK':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Loaded</Badge>;
      case 'NOT_FOUND':
        return <Badge variant="outline" className="text-amber-600">Not Found</Badge>;
      case 'ERROR':
        return <Badge variant="outline" className="text-red-600">Error</Badge>;
      case 'MANUAL_REQUIRED':
        return <Badge variant="outline">Manual Required</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <CardTitle className="text-sm">Property Lines</CardTitle>
            {statusBadge()}
          </div>
          <div className="flex items-center gap-2">
            {job.parcel_geojson && (
              <Button
                size="sm"
                variant="outline"
                onClick={onZoomToParcel}
                className="h-7"
              >
                <ZoomIn className="w-3 h-3 mr-1" />
                Zoom
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="h-7"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Disclaimer */}
        <Alert className="border-blue-500 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs">
            Property lines shown are GIS approximations and may not match a legal survey. Verify property boundaries before installation.
          </AlertDescription>
        </Alert>

        {/* Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="showParcel" 
            checked={showParcelOverlay}
            onCheckedChange={onToggleParcelOverlay}
            disabled={!job.parcel_geojson}
          />
          <Label htmlFor="showParcel" className="text-sm cursor-pointer">
            Show Property Lines on Map
          </Label>
        </div>

        {/* Parcel Info */}
        {job.parcel_geojson && (
          <div className="text-xs text-slate-600 space-y-1">
            {job.parcel_id && (
              <p><span className="font-medium">Parcel ID:</span> {job.parcel_id}</p>
            )}
            {job.parcel_source && (
              <p><span className="font-medium">Source:</span> {job.parcel_source}</p>
            )}
            {job.parcel_last_fetched_at && (
              <p><span className="font-medium">Last Updated:</span> {new Date(job.parcel_last_fetched_at).toLocaleDateString()}</p>
            )}
          </div>
        )}

        {/* Error/Status Messages */}
        {error && (
          <Alert className="border-amber-500 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {job.parcel_fetch_status === 'MANUAL_REQUIRED' && (
          <Alert className="border-slate-500 bg-slate-50">
            <Info className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Parcel lines not available from public county service. Draw property boundary manually on the map.
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-fetch on mount if not yet fetched */}
        {!job.parcel_geojson && !loading && !job.parcel_fetch_status && (
          <Button
            size="sm"
            onClick={() => fetchParcel(false)}
            className="w-full"
          >
            Load Property Lines
          </Button>
        )}
      </CardContent>
    </Card>
  );
}