import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Ruler, Trash2, Pencil, CheckCircle, Send, Loader2, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColors = {
  "Draft": "bg-gray-100 text-gray-700 border-gray-200",
  "Inspection Complete": "bg-blue-100 text-blue-700 border-blue-200",
  "Sent to Office": "bg-amber-100 text-amber-700 border-amber-200",
  "Materials Ordered": "bg-purple-100 text-purple-700 border-purple-200",
  "Installed": "bg-green-100 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-700 border-slate-200",
  "Proposal Signed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Sold": "bg-green-100 text-green-700 border-green-200",
  "Demo/No Sale": "bg-red-100 text-red-700 border-red-200",
  "Rescheduled": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Cancelled": "bg-red-100 text-red-700 border-red-200",
  "No Show": "bg-orange-100 text-orange-700 border-orange-200"
};

export default function JobCard({ job, onDelete, onStatusChange }) {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    await onStatusChange(job.id, newStatus);
    setIsUpdating(false);
  };

  const handleCardClick = () => {
    navigate(createPageUrl(`JobDetail?id=${job.id}`));
  };

  return (
    <Card className="hover:shadow-xl transition-all duration-200 border border-slate-200 hover:border-emerald-300 group cursor-pointer" onClick={handleCardClick}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-slate-900">{job.jobNumber || 'New Job'}</p>
            <p className="text-slate-700 font-semibold text-base">{job.customerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className={`${statusColors[job.status] || statusColors.Draft} border px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1`}
                  disabled={isUpdating}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                  {job.status || 'Draft'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Draft'); }}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Inspection Complete'); }}>
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                  Inspection Complete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Sent to Office'); }}>
                  <Send className="w-4 h-4 mr-2 text-amber-600" />
                  Sent to Office
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Materials Ordered'); }}>
                  Materials Ordered
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Installed'); }}>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  Installed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Proposal Signed'); }}>
                  Proposal Signed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Sold'); }}>
                  Sold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Demo/No Sale'); }}>
                  Demo/No Sale
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Rescheduled'); }}>
                  Rescheduled
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Cancelled'); }}>
                  Cancelled
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('No Show'); }}>
                  No Show
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('Closed'); }}>
                  Closed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="ghost"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="Job Cost"
              onClick={(e) => {
                e.stopPropagation();
                navigate(createPageUrl(`JobCost?jobId=${job.id}`));
              }}
            >
              <DollarSign className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                navigate(createPageUrl(`EditJob?id=${job.id}`));
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(job);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2.5 text-slate-600">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="truncate font-medium">{job.addressLine1}, {job.city}</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <span className="truncate font-medium">{job.customerPhone}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-3 text-sm">
            <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold">
              {job.materialType}
            </span>
            <span className="text-slate-600 font-medium">{job.fenceHeight}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-700">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Ruler className="w-4 h-4" />
            </div>
            <span className="font-bold text-base">{job.totalLF || 0} LF</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}