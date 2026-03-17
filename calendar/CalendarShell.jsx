import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import EventDrawerEdit from './EventDrawerEdit';
import CalendarEmptyState from './EmptyState';
import { groupEventsByDate } from './EventMapper';
import { computeVisibleRange } from '@/components/services/calendarRangeCompute';

const VIEW_OPTIONS = ['Day', 'Week', 'Month'];

export default function CalendarShell({ appointments = [], production = [], isLoading = false, onRangeChange, writeEnabled = false, onCreateClick, companyId }) {
  const [selectedTab, setSelectedTab] = useState('appointments');
  const [viewMode, setViewMode] = useState('Month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const events = selectedTab === 'appointments' ? appointments : production;
  const hasEvents = events.length > 0;
  
  // Group events by date
  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);
  const eventDates = Object.keys(groupedEvents).sort();
  
  // Get current month/week range
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };
  
  const weekStart = getWeekStart(new Date(currentDate));
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  // Filter events for current view
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = event.startAt;
      
      if (viewMode === 'Day') {
        return eventDate.toDateString() === currentDate.toDateString();
      } else if (viewMode === 'Week') {
        return eventDate >= weekStart && eventDate <= weekEnd;
      } else {
        return eventDate >= monthStart && eventDate <= monthEnd;
      }
    });
  }, [events, viewMode, currentDate, monthStart, monthEnd, weekStart, weekEnd]);
  
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'Month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'Week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };
  
  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'Month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'Week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };
  
  const handleToday = () => {
    setCurrentDate(new Date());
  };
  
  // Emit visible range changes for parent (Calendar.jsx) to query CalendarEvent
  useEffect(() => {
    if (onRangeChange) {
      const { rangeStartISO, rangeEndISO } = computeVisibleRange(currentDate, viewMode);
      onRangeChange({ rangeStartISO, rangeEndISO, viewMode });
    }
  }, [currentDate, viewMode, onRangeChange]);
  
  const formatHeader = () => {
    const options = { year: 'numeric', month: 'long' };
    if (viewMode === 'Day') {
      return currentDate.toLocaleDateString('en-US', { ...options, day: 'numeric', weekday: 'long' });
    } else if (viewMode === 'Week') {
      const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', options);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-b-none bg-white border-b border-slate-200">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 flex flex-col bg-white">
          {/* Header: Navigation + View Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h2 className="text-lg font-semibold text-slate-900 min-w-64 text-center">
                  {formatHeader()}
                </h2>
                <button
                  onClick={handleNext}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="hidden md:inline-flex"
              >
                Today
              </Button>
            </div>
            
            {/* View Mode Toggle + Create Button */}
            <div className="flex gap-2">
              {VIEW_OPTIONS.map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                  className={viewMode === mode ? 'bg-[#006FBA] hover:bg-[#005EA5]' : ''}
                >
                  {mode}
                </Button>
              ))}
              {writeEnabled && (
                <Button
                  size="sm"
                  onClick={onCreateClick}
                  className="bg-[#52AE22] hover:bg-[#3B8D3E]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New
                </Button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-slate-500">Loading events...</p>
              </div>
            ) : !hasEvents ? (
              <CalendarEmptyState tab={selectedTab} reason="no-events" />
            ) : filteredEvents.length === 0 ? (
              <CalendarEmptyState tab={selectedTab} reason="no-dates" />
            ) : (
              <div className="p-6 space-y-4">
                {filteredEvents.map((event) => {
                  const isDraggable = writeEnabled && event.source === 'calendarEvent';
                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      draggable={isDraggable}
                      className={`p-4 bg-gradient-to-r from-[#006FBA]/5 to-[#005EA5]/5 border border-[#006FBA]/20 rounded-lg hover:shadow-md hover:border-[#006FBA]/40 transition-all ${
                        isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{event.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {event.startAt.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {event.meta?.jobNumber && (
                            <p className="text-xs text-slate-500 font-mono mt-2">
                              Job {event.meta.jobNumber}
                            </p>
                          )}
                        </div>
                        <span className="px-3 py-1 bg-white rounded-full text-xs font-semibold text-[#006FBA] border border-[#006FBA]/30">
                          {event.type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Tabs>
      
      {/* Event Drawer (with edit support if Phase 3 enabled) */}
      {selectedEvent && (
        <EventDrawerEdit
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          writeEnabled={writeEnabled}
          companyId={companyId}
        />
      )}
    </div>
  );
}