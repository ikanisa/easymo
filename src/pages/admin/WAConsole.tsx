import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Terminal, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ADAPTER } from "@/lib/adapter";
import type { WAConsoleLog, Subscription, Settings } from "@/lib/types";

export default function WAConsole() {
  const [message, setMessage] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [logs, setLogs] = useState<WAConsoleLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const adminNumbers = settings?.admin_whatsapp_numbers?.split(',') || [];

  const loadData = useCallback(async () => {
    try {
      const [subs, config] = await Promise.all([
        ADAPTER.getSubscriptions(),
        ADAPTER.getSettings()
      ]);
      setSubscriptions(subs);
      setSettings(config);
      if (!fromNumber && config.admin_whatsapp_numbers) {
        setFromNumber(config.admin_whatsapp_numbers.split(',')[0] || '');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [fromNumber]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadSubscriptions = async () => {
    try {
      const subs = await ADAPTER.getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
  };

  const addLog = (log: Omit<WAConsoleLog, 'timestamp'>) => {
    setLogs(prev => [...prev, { ...log, timestamp: new Date().toISOString() }]);
  };

  const processMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    addLog({ type: 'incoming', from: fromNumber, message: message.trim() });
    
    try {
      // Phase-1: Simplified message processing
      const lowerMsg = message.trim().toLowerCase();
      
      if (lowerMsg.includes('list')) {
        const pending = subscriptions.filter(s => s.status === 'pending_review');
        addLog({ 
          type: 'outgoing', 
          message: `Found ${pending.length} pending subscriptions: ${pending.map(s => `#${s.id}`).join(', ')}` 
        });
        toast({
          title: "Command Processed",
          description: `Listed ${pending.length} pending subscriptions`,
        });
      } else if (lowerMsg.includes('approve')) {
        // Extract ID from message (simplified parsing)
        const idMatch = message.match(/\d+/);
        if (idMatch) {
          const subId = parseInt(idMatch[0]);
          await ADAPTER.approveSubscription(subId);
          addLog({ type: 'outgoing', message: `✅ Subscription #${subId} approved` });
          toast({
            title: "Subscription Approved",
            description: `Subscription #${subId} has been approved`,
          });
          loadSubscriptions();
        }
      } else if (lowerMsg.includes('reject')) {
        // Extract ID from message (simplified parsing)
        const idMatch = message.match(/\d+/);
        if (idMatch) {
          const subId = parseInt(idMatch[0]);
          await ADAPTER.rejectSubscription(subId);
          addLog({ type: 'outgoing', message: `❌ Subscription #${subId} rejected` });
          toast({
            title: "Subscription Rejected",
            description: `Subscription #${subId} has been rejected`,
          });
          loadSubscriptions();
        }
      } else {
        addLog({ type: 'system', message: 'Command not recognized. Try: list, approve [id], reject [id]' });
      }
    } catch (error) {
      console.error('Message processing error:', error);
      addLog({ type: 'error', message: 'Failed to process command' });
      toast({
        title: "Command Failed",
        description: "An error occurred while processing the command",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

  const quickFill = (cmd: string) => {
    setMessage(cmd);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getMessageTypeColor = (type: WAConsoleLog['type']) => {
    switch (type) {
      case 'incoming': return 'text-blue-600';
      case 'outgoing': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'system': return 'text-gray-600';
      default: return 'text-gray-900';
    }
  };

  const getMessageTypeBadge = (type: WAConsoleLog['type']) => {
    const variants = {
      incoming: 'default' as const,
      outgoing: 'secondary' as const,
      error: 'destructive' as const,
      system: 'outline' as const
    };
    return variants[type] || 'outline';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Console"
        description="Simulate WhatsApp Admin Commands (Phase-1 Development Tool)"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Console Log */}
        <Card className="lg:order-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Terminal className="h-5 w-5" />
              <span>Console Log</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 h-96 overflow-y-auto p-4 bg-muted/30 rounded-md font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No messages yet...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <Badge variant={getMessageTypeBadge(log.type)} className="shrink-0 text-xs">
                      {log.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {log.from && (
                        <span className="text-xs text-muted-foreground">
                          From {log.from}:{' '}
                        </span>
                      )}
                      <span className={getMessageTypeColor(log.type)}>
                        {log.message}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Message Input</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quick Commands</label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => quickFill("list pending")}
                >
                  List Pending
                </Button>
                {subscriptions.filter(s => s.status === 'pending_review').slice(0, 3).map(sub => (
                  <div key={sub.id} className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => quickFill(`approve ${sub.id}`)}
                    >
                      Approve {sub.id}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => quickFill(`reject ${sub.id}`)}
                    >
                      Reject {sub.id}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">From Number</label>
              <Select value={fromNumber} onValueChange={setFromNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select admin number" />
                </SelectTrigger>
                <SelectContent>
                  {adminNumbers.map(number => (
                    <SelectItem key={number} value={number}>
                      {number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type admin command... (e.g., 'list pending', 'approve 1', 'reject 2')"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    processMessage();
                  }
                }}
              />
            </div>

            <Button 
              onClick={processMessage} 
              disabled={loading || !message.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Processing...' : 'Send Message'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Current Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Current Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {subscriptions.length === 0 ? (
              <p className="text-muted-foreground">No subscriptions found.</p>
            ) : (
              subscriptions.slice(0, 5).map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center space-x-2">
                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                      #{sub.id}
                    </Badge>
                    <span className="text-sm">
                      {sub.user_ref_code || 'No ref'} - {sub.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sub.amount} RWF
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
