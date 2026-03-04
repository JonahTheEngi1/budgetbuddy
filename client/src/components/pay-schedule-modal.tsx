import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck } from "lucide-react";
import type { PaySchedule } from "@shared/schema";

export function PayScheduleSetup({ externalOpen, onExternalClose }: { externalOpen?: boolean; onExternalClose?: () => void } = {}) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [interval, setInterval] = useState<"7" | "14">("14");
  const [nextPayDate, setNextPayDate] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const { data: schedule } = useQuery<PaySchedule | null>({
    queryKey: ["/api/pay-schedule"],
  });

  const open = externalOpen ?? internalOpen;

  useEffect(() => {
    if (!schedule && !externalOpen) {
      setInternalOpen(true);
    }
  }, [schedule, externalOpen]);

  useEffect(() => {
    if (open && schedule) {
      setInterval(schedule.interval);
      setNextPayDate(schedule.nextPayDate);
      setPayAmount(String(schedule.payAmount));
    }
  }, [open, schedule]);

  function handleOpenChange(v: boolean) {
    if (!v && onExternalClose) {
      onExternalClose();
    }
    setInternalOpen(v);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: PaySchedule) => {
      const res = await apiRequest("POST", "/api/pay-schedule", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget-history"] });
      handleOpenChange(false);
      toast({ title: "Pay schedule saved" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!nextPayDate || amount <= 0) return;
    saveMutation.mutate({ interval, nextPayDate, payAmount: amount });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            {schedule ? "Edit Pay Schedule" : "Pay Schedule Setup"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pay Interval</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as "7" | "14")}>
              <SelectTrigger data-testid="select-pay-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Weekly (7 days)</SelectItem>
                <SelectItem value="14">Bi-weekly (14 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Next Pay Date</Label>
            <Input
              data-testid="input-next-pay-date"
              type="date"
              value={nextPayDate}
              onChange={(e) => setNextPayDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Pay Amount (per check)</Label>
            <Input
              data-testid="input-pay-amount"
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saveMutation.isPending} data-testid="button-save-pay-schedule">
            Save Schedule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayDayPrompt() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: schedule } = useQuery<PaySchedule | null>({
    queryKey: ["/api/pay-schedule"],
  });

  useEffect(() => {
    if (schedule) {
      const today = new Date().toISOString().slice(0, 10);
      if (schedule.nextPayDate <= today) {
        setOpen(true);
      }
    }
  }, [schedule]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      const currentMonth = new Date().toISOString().slice(0, 7);
      await apiRequest("POST", `/api/budget/${currentMonth}`, { income: schedule.payAmount * (schedule.interval === "7" ? 4 : 2) });
      const next = new Date(schedule.nextPayDate);
      next.setDate(next.getDate() + parseInt(schedule.interval));
      const updated: PaySchedule = {
        ...schedule,
        nextPayDate: next.toISOString().slice(0, 10),
      };
      const res = await apiRequest("POST", "/api/pay-schedule", updated);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget-history"] });
      setOpen(false);
      toast({ title: "Pay recorded and schedule advanced" });
    },
  });

  if (!schedule) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
            Pay Day!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your pay date has arrived. You should receive{" "}
            <span className="font-semibold text-foreground">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(schedule.payAmount)}
            </span>{" "}
            today. This will be recorded to your current monthly budget.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-confirm-pay">
              Confirm & Record
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} data-testid="button-dismiss-pay">
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AutoBudgetGenerator() {
  const { data: schedule } = useQuery<PaySchedule | null>({
    queryKey: ["/api/pay-schedule"],
  });

  const autoGenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budget/auto-generate");
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.created) {
        queryClient.invalidateQueries({ queryKey: ["/api/budget-history"] });
      }
    },
  });

  useEffect(() => {
    if (schedule) {
      autoGenMutation.mutate();
    }
  }, [schedule]);

  return null;
}
