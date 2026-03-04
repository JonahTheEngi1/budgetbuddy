import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Target, TrendingUp } from "lucide-react";
import type { SavingsGoal, InsertSavingsGoal } from "@shared/schema";
import { SAVINGS_METHODS } from "@shared/schema";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

const methodColors: Record<string, string> = {
  Investing: "bg-blue-500",
  "Regular Savings": "bg-emerald-500",
  "Emergency Fund": "bg-amber-500",
  Retirement: "bg-purple-500",
  Vacation: "bg-pink-500",
  Other: "bg-gray-500",
};

export default function SavingsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InsertSavingsGoal>({
    name: "",
    targetAmount: 0,
    currentAmount: 0,
    method: "",
    percentage: 0,
  });

  const { data: goals, isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: InsertSavingsGoal) => {
      const res = await apiRequest("POST", "/api/savings-goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      setOpen(false);
      setForm({ name: "", targetAmount: 0, currentAmount: 0, method: "", percentage: 0 });
      toast({ title: "Savings goal added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSavingsGoal> }) => {
      const res = await apiRequest("PUT", `/api/savings-goals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/savings-goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      toast({ title: "Goal deleted" });
    },
  });

  const totalSaved = goals?.reduce((s, g) => s + g.currentAmount, 0) ?? 0;
  const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0;
  const totalPercentage = goals?.reduce((s, g) => s + g.percentage, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-savings-title">Savings Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and allocate your savings</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-goal">
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Savings Goal</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (form.name && form.targetAmount > 0 && form.method) {
                  addMutation.mutate(form);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input
                  data-testid="input-goal-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Emergency Fund, Vacation, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Target Amount</Label>
                <Input
                  data-testid="input-goal-target"
                  type="number"
                  step="0.01"
                  value={form.targetAmount || ""}
                  onChange={(e) => setForm({ ...form, targetAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label>Current Amount</Label>
                <Input
                  data-testid="input-goal-current"
                  type="number"
                  step="0.01"
                  value={form.currentAmount || ""}
                  onChange={(e) => setForm({ ...form, currentAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger data-testid="select-goal-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {SAVINGS_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Allocation %</Label>
                <Input
                  data-testid="input-goal-percentage"
                  type="number"
                  min={0}
                  max={100}
                  value={form.percentage || ""}
                  onChange={(e) => setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })}
                  placeholder="25"
                />
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-goal">
                Create Goal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Total Saved</p>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-total-saved">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Total Target</p>
              <Target className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-total-target">{formatCurrency(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Allocated</p>
              <Target className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-total-allocated">{totalPercentage}%</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goals && goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const barColor = methodColors[goal.method] || methodColors.Other;

            return (
              <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{goal.name}</h3>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-xs font-medium ${barColor}/20 text-foreground`}>
                        {goal.method}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(goal.id)}
                      data-testid={`button-delete-goal-${goal.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2 text-sm">
                      <span className="font-mono">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">of {formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% complete</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1 text-sm">
                      <span className="text-muted-foreground">Allocation</span>
                      <span className="font-medium">{goal.percentage}%</span>
                    </div>
                    <Slider
                      value={[goal.percentage]}
                      min={0}
                      max={100}
                      step={1}
                      onValueCommit={(value) => {
                        updateMutation.mutate({ id: goal.id, data: { percentage: value[0] } });
                      }}
                      data-testid={`slider-allocation-${goal.id}`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Add funds"
                      className="flex-1"
                      data-testid={`input-add-funds-${goal.id}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          if (val > 0) {
                            updateMutation.mutate({
                              id: goal.id,
                              data: { currentAmount: goal.currentAmount + val },
                            });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                        const val = parseFloat(input.value);
                        if (val > 0) {
                          updateMutation.mutate({
                            id: goal.id,
                            data: { currentAmount: goal.currentAmount + val },
                          });
                          input.value = "";
                        }
                      }}
                      data-testid={`button-add-funds-${goal.id}`}
                    >
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">No savings goals yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first savings goal to start tracking</p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-goal-empty">
              <Plus className="w-4 h-4 mr-2" />
              Create Goal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
