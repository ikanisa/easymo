import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Settings as SettingsIcon, DollarSign, MapPin, Hash, MessageCircle, RotateCcw } from "lucide-react";
import { ADAPTER } from "@/lib/adapter";
import { useToast } from "@/hooks/use-toast";
import { showDevTools } from "@/lib/env";
import type { Settings } from "@/lib/types";

export default function SettingsAdmin() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await ADAPTER.getSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      await ADAPTER.updateSettings(settings);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetMockData = async () => {
    if (!ADAPTER.resetMockData) return;
    
    try {
      await ADAPTER.resetMockData();
      await loadSettings();
      toast({
        title: "Success",
        description: "Mock data has been reset",
      });
    } catch (error) {
      console.error("Failed to reset mock data:", error);
      toast({
        title: "Error",
        description: "Failed to reset mock data",
        variant: "destructive",
      });
    }
  };

  const updateSetting = (key: keyof Settings, value: string | number) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Configure system parameters"
        />
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure system parameters"
        action={{
          label: saving ? "Saving..." : "Save Changes",
          onClick: saveSettings,
          variant: "default",
        }}
      />

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SettingsIcon className="h-5 w-5" />
              <span>General Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-price" className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Subscription Price (RWF)</span>
                </Label>
                <Input
                  id="subscription-price"
                  type="number"
                  value={settings.subscription_price}
                  onChange={(e) => updateSetting('subscription_price', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search-radius" className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>Search Radius (km)</span>
                </Label>
                <Input
                  id="search-radius"
                  type="number"
                  value={settings.search_radius_km}
                  onChange={(e) => updateSetting('search_radius_km', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-results" className="flex items-center space-x-2">
                  <Hash className="h-4 w-4" />
                  <span>Max Results</span>
                </Label>
                <Input
                  id="max-results"
                  type="number"
                  value={settings.max_results}
                  onChange={(e) => updateSetting('max_results', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="momo-payee" className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>MoMo Payee Number</span>
                </Label>
                <Input
                  id="momo-payee"
                  value={settings.momo_payee_number}
                  onChange={(e) => updateSetting('momo_payee_number', e.target.value)}
                  placeholder="+250..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Admin Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>WhatsApp Admin Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-numbers">
                Admin WhatsApp Numbers (comma-separated)
              </Label>
              <Input
                id="admin-numbers"
                value={settings.admin_whatsapp_numbers || ""}
                onChange={(e) => updateSetting('admin_whatsapp_numbers', e.target.value)}
                placeholder="+250781111111,+250782222222"
              />
              <p className="text-xs text-muted-foreground">
                Phase-2: Only these numbers can send admin commands via WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Developer Tools */}
        {showDevTools() && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>Developer Tools</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Reset Mock Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Restore all mock data to default state
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={resetMockData}
                  >
                    Reset Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}