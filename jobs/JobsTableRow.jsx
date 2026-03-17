import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Settings, CheckCircle, XCircle, DollarSign, Package, Trash2, Edit2 } from 'lucide-react';

function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function isPlaceholderName(v) {
  const s = safeText(v);
  return !!(s && /^customer\s+for\s+j-/i.test(s));
}

export default function JobsTableRow({
  job,
  linkedJobs,
  currentUser,
  onSetStatusDrawer,
  onMarkSold,
  onSetUnsoldDialog,
  onPaymentStatus,
  onInstallStatus,
  onSetDeleteCrmJob,
  onSetNameRepairModal,
  computeJobListLabel,
  getBadgeVariant,
  getBadgeClass
}) {
  const { label, badgeType } = computeJobListLabel(job);
  const normalizedName = safeText(job.customerName);
  const linkedName = safeText(linkedJobs?.[job.externalJobId]?.customerName);
  const isBad = !normalizedName || normalizedName === "Unknown Customer" || isPlaceholderName(normalizedName);
  const displayName = isBad ? "Unknown Customer" : normalizedName || linkedName || "—";

  return (
    <tr className="hover:bg-slate-800/40 transition-colors">
      <td className="px-4 py-3">
        <Link 
          to={job.externalJobId ? createPageUrl(`JobDetail?jobId=${job.externalJobId}`) : '#'}
          className="text-[#52AE22] hover:text-[#3B8D3E] font-medium transition-colors"
        >
          {job.jobNumber}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-200 flex items-center justify-between gap-2">
        <span>{displayName}</span>
        {isBad && (
          <button
            onClick={() => {
              onSetNameRepairModal(job);
            }}
            className="text-orange-400 hover:text-orange-300 p-1 transition-colors"
            title="Fix customer name"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge 
          variant={getBadgeVariant(badgeType)}
          className={`cursor-pointer hover:opacity-90 font-semibold shadow-lg ${getBadgeClass(badgeType)}`}
          onClick={() => onSetStatusDrawer(job)}
        >
          {label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSetStatusDrawer(job)}>
              <Settings className="w-4 h-4 mr-2" />
              Update Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {currentUser?.role === 'admin' && (
              <>
                <DropdownMenuItem onClick={() => onMarkSold(job)}>
                  <CheckCircle className="w-4 h-4 mr-2 text-[#52AE22]" />
                  Mark Sold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetUnsoldDialog(job)}>
                  <XCircle className="w-4 h-4 mr-2 text-red-600" />
                  Mark Unsold
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onPaymentStatus(job, 'payment_pending')}>
              <DollarSign className="w-4 h-4 mr-2" />
              Payment Pending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPaymentStatus(job, 'payment_received')}>
              <DollarSign className="w-4 h-4 mr-2 text-green-600" />
              Payment Received
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onInstallStatus(job, 'installed')}>
              <Package className="w-4 h-4 mr-2 text-green-600" />
              Mark Installed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInstallStatus(job, 'not_installed')}>
              <Package className="w-4 h-4 mr-2" />
              Mark Not Installed
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSetDeleteCrmJob(job)} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}