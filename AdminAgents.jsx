import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

/**
 * ADMIN AGENTS PAGE
 * Global agent health overview (super admin only)
 */

export default function AdminAgents() {
  const [user, setUser] = React.useState(null);
  
  React.useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);
  
  // Fetch global agent health
  const { data, isLoading } = useQuery({
    queryKey: ['globalAgentHealth'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getGlobalAgentHealth', {});
      return response.data;
    },
    enabled: user?.role === 'admin',
    refetchInterval: 30000 // Refresh every 30s
  });
  
  // RBAC enforcement
  if (user && user.role !== 'admin') {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Access Denied</h3>
                <p className="text-sm text-red-700">Super admin access required</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading || !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Agent Health Monitor</h1>
        <p className="text-slate-600 mt-2">Global overview of all intelligent agents (Last 24h)</p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.agents.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.agents.filter(a => a.status === 'GREEN').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">With Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.agents.filter(a => a.status === 'YELLOW').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">With Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.agents.filter(a => a.status === 'RED').length}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Agent Health Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-slate-600">Status</th>
                  <th className="text-left p-3 font-medium text-slate-600">Agent</th>
                  <th className="text-left p-3 font-medium text-slate-600">Mode</th>
                  <th className="text-left p-3 font-medium text-slate-600">Runs (24h)</th>
                  <th className="text-left p-3 font-medium text-slate-600">Success Rate</th>
                  <th className="text-left p-3 font-medium text-slate-600">Warnings</th>
                  <th className="text-left p-3 font-medium text-slate-600">Errors</th>
                  <th className="text-left p-3 font-medium text-slate-600">Avg Duration</th>
                  <th className="text-left p-3 font-medium text-slate-600">Alerts</th>
                  <th className="text-left p-3 font-medium text-slate-600">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <tr key={agent.agentName} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      {agent.status === 'GREEN' && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {agent.status === 'YELLOW' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                      {agent.status === 'RED' && <AlertCircle className="w-5 h-5 text-red-600" />}
                    </td>
                    <td className="p-3 font-medium">{agent.agentName}</td>
                    <td className="p-3">
                      {agent.dryRunMode ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Dry Run
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Live
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">{agent.totalRuns}</td>
                    <td className="p-3">{agent.okPercentage}%</td>
                    <td className="p-3">{agent.warnCount}</td>
                    <td className="p-3">
                      {agent.errorCount > 0 ? (
                        <span className="text-red-600 font-medium">{agent.errorCount}</span>
                      ) : (
                        agent.errorCount
                      )}
                    </td>
                    <td className="p-3">{agent.avgDuration}ms</td>
                    <td className="p-3">{agent.alertsCreated}</td>
                    <td className="p-3 text-sm text-slate-600">
                      {agent.lastRun ? new Date(agent.lastRun).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}