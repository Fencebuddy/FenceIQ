import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PERFORMANCE INSIGHTS AGENT
 * Analyzes usage patterns and expensive operations
 * Generates weekly performance reports for optimization
 */

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const companyId = "PrivacyFenceCo49319";
    
    // Get last 7 days of usage events
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const events = await base44.asServiceRole.entities.UsageEvent.filter({ 
      companyId,
      timestamp: { $gte: sevenDaysAgo }
    });

    // Aggregate metrics
    const metrics = {
      totalEvents: events.length,
      eventsByType: {},
      jobsCreated: 0,
      pricingComputed: 0,
      proposalsSent: 0,
      proposalsSigned: 0,
      avgComputeTimeMs: 0,
      peakHours: {},
      userActivity: {}
    };

    let totalComputeTime = 0;
    let computeCount = 0;

    for (const event of events) {
      // Count by type
      metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;
      
      // Track key events
      if (event.eventType === 'job_created') metrics.jobsCreated++;
      if (event.eventType === 'pricing_computed') {
        metrics.pricingComputed++;
        if (event.metadata?.computeTimeMs) {
          totalComputeTime += event.metadata.computeTimeMs;
          computeCount++;
        }
      }
      if (event.eventType === 'proposal_sent') metrics.proposalsSent++;
      if (event.eventType === 'proposal_signed') metrics.proposalsSigned++;
      
      // Peak hours
      const hour = new Date(event.timestamp).getHours();
      metrics.peakHours[hour] = (metrics.peakHours[hour] || 0) + 1;
      
      // User activity
      if (event.userId) {
        metrics.userActivity[event.userId] = (metrics.userActivity[event.userId] || 0) + 1;
      }
    }

    if (computeCount > 0) {
      metrics.avgComputeTimeMs = Math.round(totalComputeTime / computeCount);
    }

    // Identify performance concerns
    const concerns = [];
    
    if (metrics.avgComputeTimeMs > 3000) {
      concerns.push({
        type: 'SLOW_PRICING',
        message: `Average pricing computation is ${metrics.avgComputeTimeMs}ms (target: <2000ms)`,
        severity: 'WARN'
      });
    }

    if (metrics.pricingComputed > metrics.jobsCreated * 5) {
      concerns.push({
        type: 'EXCESSIVE_RECOMPUTE',
        message: `Pricing computed ${metrics.pricingComputed} times for ${metrics.jobsCreated} jobs (ratio: ${(metrics.pricingComputed / metrics.jobsCreated).toFixed(1)}:1)`,
        severity: 'ERROR'
      });
    }

    // Find peak hour
    const peakHour = Object.entries(metrics.peakHours)
      .sort((a, b) => b[1] - a[1])[0];

    const report = {
      period: 'Last 7 days',
      generated: new Date().toISOString(),
      metrics,
      concerns,
      insights: {
        peakHour: peakHour ? `${peakHour[0]}:00 (${peakHour[1]} events)` : 'N/A',
        mostActiveUser: Object.entries(metrics.userActivity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        conversionRate: metrics.proposalsSent > 0 
          ? `${((metrics.proposalsSigned / metrics.proposalsSent) * 100).toFixed(1)}%`
          : 'N/A'
      },
      runDurationMs: Date.now() - startTime
    };

    // Send weekly summary email
    if (concerns.length > 0) {
      await sendPerformanceReport(base44, report);
    }

    return Response.json(report);

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

async function sendPerformanceReport(base44, report) {
  const emailBody = `
    <h2>📊 FenceIQ Performance Insights (Weekly)</h2>
    
    <h3>Key Metrics:</h3>
    <ul>
      <li>Jobs Created: ${report.metrics.jobsCreated}</li>
      <li>Pricing Computed: ${report.metrics.pricingComputed}</li>
      <li>Proposals Sent: ${report.metrics.proposalsSent}</li>
      <li>Proposals Signed: ${report.metrics.proposalsSigned}</li>
      <li>Avg Compute Time: ${report.metrics.avgComputeTimeMs}ms</li>
      <li>Conversion Rate: ${report.insights.conversionRate}</li>
    </ul>
    
    ${report.concerns.length > 0 ? `
      <h3>⚠️ Performance Concerns:</h3>
      <ul>
        ${report.concerns.map(c => `
          <li><strong>[${c.severity}]</strong> ${c.type}: ${c.message}</li>
        `).join('')}
      </ul>
    ` : '<p>✅ No performance concerns detected</p>'}
    
    <h3>Insights:</h3>
    <ul>
      <li>Peak Hour: ${report.insights.peakHour}</li>
      <li>Most Active User: ${report.insights.mostActiveUser}</li>
    </ul>
    
    <p><em>Generated: ${report.generated}</em></p>
  `;

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'admin@fencebuddy.com',
      subject: '📊 FenceIQ Weekly Performance Report',
      body: emailBody
    });
  } catch (error) {
    console.error('Failed to send performance report:', error);
  }
}