import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Unplug, Plug, TestTube, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getPrinterPreferences,
  savePrinterPreferences,
  isWebSerialSupported,
  connectSerialPrinter,
  disconnectSerialPrinter,
  isSerialConnected,
  testPrint,
  type PaperSize,
} from '@/lib/receiptPrinter';

export default function PrinterSettings() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(getPrinterPreferences());
  const [connected, setConnected] = useState(isSerialConnected());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(isSerialConnected());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  function updatePref(key: string, value: unknown) {
    const updated = savePrinterPreferences({ [key]: value });
    setPrefs(updated);
  }

  async function handleConnect() {
    setConnecting(true);
    const success = await connectSerialPrinter();
    setConnecting(false);
    setConnected(success);
    toast({
      title: success ? 'Printer Connected' : 'Connection Failed',
      description: success ? 'Thermal printer connected via USB/Serial' : 'Could not connect. Make sure the printer is on and plugged in.',
      variant: success ? 'default' : 'destructive',
    });
  }

  async function handleDisconnect() {
    await disconnectSerialPrinter();
    setConnected(false);
    toast({ title: 'Printer Disconnected' });
  }

  async function handleTestPrint() {
    try {
      await testPrint();
      toast({ title: 'Test Print Sent', description: connected ? 'Check your printer for the test receipt.' : 'Logged test data to console (no printer connected).' });
    } catch {
      toast({ variant: 'destructive', title: 'Test Print Failed' });
    }
  }

  const serialSupported = isWebSerialSupported();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Receipt & Printing
        </CardTitle>
        <CardDescription>Configure thermal printer connection and receipt format</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <div className="flex items-center gap-3">
            {connected ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-sm">Thermal Printer</p>
              <p className="text-xs text-muted-foreground">
                {connected ? 'Connected via USB/Serial' : 'Not connected'}
              </p>
            </div>
          </div>
          <Badge variant={connected ? 'default' : 'secondary'}>
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Connection Buttons */}
        <div className="flex gap-2">
          {!connected ? (
            <Button
              onClick={handleConnect}
              disabled={!serialSupported || connecting}
              variant="outline"
              className="flex-1"
            >
              <Plug className="h-4 w-4 mr-2" />
              {connecting ? 'Connecting...' : 'Connect Printer'}
            </Button>
          ) : (
            <Button onClick={handleDisconnect} variant="outline" className="flex-1">
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          )}
          <Button onClick={handleTestPrint} variant="outline">
            <TestTube className="h-4 w-4 mr-2" />
            Test Print
          </Button>
        </div>

        {!serialSupported && (
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            ⚠️ Web Serial API is not supported in this browser. Use Chrome or Edge for USB printer support. Browser print dialog will be used as fallback.
          </p>
        )}

        {/* Paper Size */}
        <div className="space-y-2">
          <Label>Paper Size</Label>
          <Select value={prefs.paperSize} onValueChange={(v) => updatePref('paperSize', v as PaperSize)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm (Standard)</SelectItem>
              <SelectItem value="58mm">58mm (Compact)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Print */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-print after payment</Label>
            <p className="text-xs text-muted-foreground">Automatically print receipt when a sale is completed</p>
          </div>
          <Switch
            checked={prefs.autoPrint}
            onCheckedChange={(v) => updatePref('autoPrint', v)}
          />
        </div>

        {/* Show Tax Breakdown */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Show tax breakdown</Label>
            <p className="text-xs text-muted-foreground">Display tax amount separately on receipts</p>
          </div>
          <Switch
            checked={prefs.showTaxBreakdown}
            onCheckedChange={(v) => updatePref('showTaxBreakdown', v)}
          />
        </div>

        {/* Custom Header / Footer */}
        <div className="space-y-2">
          <Label>Receipt Header Text</Label>
          <Input
            placeholder="e.g. Welcome to our store!"
            value={prefs.receiptHeader}
            onChange={(e) => updatePref('receiptHeader', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Receipt Footer Text</Label>
          <Input
            placeholder="e.g. Thank you for your purchase!"
            value={prefs.receiptFooter}
            onChange={(e) => updatePref('receiptFooter', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
