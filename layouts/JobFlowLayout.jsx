import React from 'react';

export default function JobFlowLayout({ children, currentPage, onAction }) {
  return (
    <div className="jobflow-layout flex flex-col h-screen bg-slate-50">
      <main className="jobflow-content flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}