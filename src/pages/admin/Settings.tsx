import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/PageHeader";
import { Settings as SettingsIcon, DollarSign, MapPin, Hash, MessageCircle, RotateCcw, Shield } from "lucide-react";
import { AdminAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { showDevTools } from "@/lib/env";
import type { Settings } from "@/lib/types";

export default function SettingsAdmin() {
  const [formData, setFormData] = useState<(Settings & { pro_enabled: boolean }) | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    data: settings, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: AdminAPI.getSettings,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Settings & { pro_enabled: boolean }>) => 
      AdminAPI.saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: (error) => {
      console.error("Failed to save settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveSettings = () => {
    if (!formData) return;
    saveMutation.mutate(formData);
  };

  const updateSetting = (key: keyof (Settings & { pro_enabled: boolean }), value: string | number | boolean) => {
    if (!formData) return;
    setFormData(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (isLoading || !formData) {
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
          label: saveMutation.isPending ? "Saving..." : "Save Changes",
          onClick: saveSettings,
          variant: "default",
          disabled: saveMutation.isPending,
        }}
      />

      <div className="grid gap-6">
        {/* Pro Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Pro Mode Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="pro-enabled">Enable Pro Mode</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, driver services require subscription or credits
                </p>
              </div>
              <Switch
                id="pro-enabled"
                checked={formData.pro_enabled}
                onCheckedChange={(checked) => updateSetting('pro_enabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

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
                  value={formData.subscription_price}
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
                  value={formData.search_radius_km}
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
                  value={formData.max_results}
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
                  value={formData.momo_payee_number}
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
                value={formData.admin_whatsapp_numbers || ""}
                onChange={(e) => updateSetting('admin_whatsapp_numbers', e.target.value)}
                placeholder="+250781111111,+250782222222"
              />
              <div className="space-y-2">
                <Label htmlFor="support-phone">
                  Support Phone (E.164)
                </Label>
                <Input
                  id="support-phone"
                  value={formData.support_phone_e164 || ""}
                  onChange={(e) => updateSetting('support_phone_e164', e.target.value)}
                  placeholder="+250781234567"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Phase-2: Only these numbers can send admin commands via WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}