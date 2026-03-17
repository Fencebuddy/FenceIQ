import React from 'react';
import { Calendar } from 'lucide-react';

export default function CalendarEmptyState({ tab, reason = 'no-events' }) {
  const messages = {
    'no-events': {
      title: `No ${tab === 'appointments' ? 'Appointments' : 'Production Events'}`,
      subtitle: 'Create or schedule events to see them here.',
    },
    'no-dates': {
      title: 'No Dates Available',
      subtitle: 'Jobs need appointment or install dates to display on the calendar.',
    },
    'error': {
      title: 'Unable to Load Events',
      subtitle: 'Please try refreshing the page.',
    },
  };
  
  const message = messages[reason] || messages['no-events'];
  
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
      <Calendar className="w-16 h-16 text-slate-300" />
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{message.title}</h3>
        <p className="text-sm text-slate-600 mt-2">{message.subtitle}</p>
      </div>
    </div>
  );
}