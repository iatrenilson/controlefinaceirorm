import { useState, useEffect, useMemo } from "react";
import { format, parseISO, subDays, subHours } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Loader2 } from "lucide-react";

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary"; icon: typeof CheckCircle2 }> = {
  sent: { label: "Enviado", variant: "default", icon: CheckCircle2 },
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  dlq: { label: "Falhou (DLQ)", variant: "destructive", icon: XCircle },
  rate_limited: { label: "Rate Limited", variant: "outline", icon: AlertTriangle },
  suppressed: { label: "Suprimido", variant: "outline", icon: AlertTriangle },
  bounced: { label: "Rejeitado", variant: "destructive", icon: XCircle },
  complained: { label: "Reclamado", variant: "destructive", icon: AlertTriangle },
};

const TIME_RANGES = [
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

export const EmailDashboard = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case "24h": startDate = subHours(now, 24); break;
      case "30d": startDate = subDays(now, 30); break;
      default: startDate = subDays(now, 7);
    }

    const { data, error } = await supabase
      .from("email_send_log")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      setLogs(data as EmailLog[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [timeRange]);

  // Deduplicate by message_id — keep latest status per email
  const dedupedLogs = useMemo(() => {
    const seen = new Map<string, EmailLog>();
    for (const log of logs) {
      const key = log.message_id || log.id;
      const existing = seen.get(key);
      if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
        seen.set(key, log);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [logs]);

  // Get unique templates
  const templates = useMemo(() => {
    const set = new Set(dedupedLogs.map(l => l.template_name));
    return Array.from(set).sort();
  }, [dedupedLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return dedupedLogs.filter(l => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (templateFilter !== "all" && l.template_name !== templateFilter) return false;
      return true;
    });
  }, [dedupedLogs, statusFilter, templateFilter]);

  // Stats from deduplicated
  const stats = useMemo(() => {
    const total = dedupedLogs.length;
    const sent = dedupedLogs.filter(l => l.status === "sent").length;
    const failed = dedupedLogs.filter(l => ["failed", "dlq"].includes(l.status)).length;
    const pending = dedupedLogs.filter(l => l.status === "pending").length;
    return { total, sent, failed, pending };
  }, [dedupedLogs]);

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, variant: "outline" as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold">Log de E-mails</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="dlq">DLQ</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum e-mail encontrado no período.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden max-h-[500px] overflow-auto">
                {filteredLogs.slice(0, 50).map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{log.recipient_email}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{log.template_name}</Badge>
                      <span>{format(parseISO(log.created_at), "dd/MM HH:mm")}</span>
                    </div>
                    {log.error_message && (
                      <p className="text-[11px] text-destructive bg-destructive/5 rounded p-1.5 truncate">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 50).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{log.template_name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.recipient_email}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                          {log.error_message || "—"}
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                </Table>
              </div>
              {filteredLogs.length > 50 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Mostrando 50 de {filteredLogs.length} registros
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
