import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, ShoppingCart, Lock, Receipt } from "lucide-react";
import type { Expense, InsertExpense, VariableCharge } from "@shared/schema";
import { EXPENSE_CATEGORIES } from "@shared/schema";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const categoryColors: Record<string, string> = {
  Streaming: "bg-purple-500/20 text-purple-300",
  Rent: "bg-blue-500/20 text-blue-300",
  Insurance: "bg-green-500/20 text-green-300",
  Utilities: "bg-yellow-500/20 text-yellow-300",
  Phone: "bg-cyan-500/20 text-cyan-300",
  Internet: "bg-indigo-500/20 text-indigo-300",
  Groceries: "bg-orange-500/20 text-orange-300",
  "Fun Money": "bg-pink-500/20 text-pink-300",
  Transportation: "bg-red-500/20 text-red-300",
  Subscriptions: "bg-pink-500/20 text-pink-300",
  Other: "bg-gray-500/20 text-gray-300",
};

export default function ExpensesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InsertExpense>({ name: "", cost: 0, category: "", date: 1, isVariable: false });
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeExpenseId, setChargeExpenseId] = useState<string | null>(null);
  const [chargeForm, setChargeForm] = useState({ amount: 0, note: "", date: new Date().toISOString().slice(0, 10) });
  const [viewChargesId, setViewChargesId] = useState<string | null>(null);

  const currentMonth = getCurrentMonth();

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: monthlyCharges } = useQuery<Record<string, VariableCharge[]>>({
    queryKey: ["/api/variable-charges", currentMonth],
  });

  const addMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setOpen(false);
      resetForm();
      toast({ title: "Expense added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertExpense> }) => {
      const res = await apiRequest("PUT", `/api/expenses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setOpen(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Expense updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: () => {
      toast({ title: "Cannot delete this expense", variant: "destructive" });
    },
  });

  const addChargeMutation = useMutation({
    mutationFn: async ({ expenseId, data }: { expenseId: string; data: { amount: number; note: string; date: string } }) => {
      const res = await apiRequest("POST", `/api/variable-charges/${currentMonth}/${expenseId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-charges", currentMonth] });
      setChargeOpen(false);
      setChargeForm({ amount: 0, note: "", date: new Date().toISOString().slice(0, 10) });
      toast({ title: "Charge added" });
    },
  });

  const deleteChargeMutation = useMutation({
    mutationFn: async ({ expenseId, chargeId }: { expenseId: string; chargeId: string }) => {
      await apiRequest("DELETE", `/api/variable-charges/${currentMonth}/${expenseId}/${chargeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-charges", currentMonth] });
      toast({ title: "Charge removed" });
    },
  });

  function resetForm() {
    setForm({ name: "", cost: 0, category: "", date: 1, isVariable: false });
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({ name: expense.name, cost: expense.cost, category: expense.category, date: expense.date, isVariable: expense.isVariable });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.category || form.cost <= 0) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      addMutation.mutate(form);
    }
  }

  const fixedExpenses = expenses?.filter((e) => !e.isVariable) ?? [];
  const variableExpenses = expenses?.filter((e) => e.isVariable) ?? [];
  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.cost, 0);
  const totalVariableBudget = variableExpenses.reduce((sum, e) => sum + e.cost, 0);

  const variableActualSpending: Record<string, number> = {};
  if (monthlyCharges) {
    for (const [expId, charges] of Object.entries(monthlyCharges)) {
      variableActualSpending[expId] = charges.reduce((s, c) => s + c.amount, 0);
    }
  }

  const totalVariableActual = variableExpenses.reduce((sum, e) => sum + (variableActualSpending[e.id] || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-expenses-title">Monthly Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recurring expenses applied to each month's budget
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  data-testid="input-expense-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Netflix, Rent, etc."
                  disabled={editingId !== null && variableExpenses.some((ve) => ve.id === editingId)}
                />
              </div>
              <div className="space-y-2">
                <Label>{form.isVariable ? "Monthly Budget" : "Cost"}</Label>
                <Input
                  data-testid="input-expense-cost"
                  type="number"
                  step="0.01"
                  value={form.cost || ""}
                  onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  data-testid="input-expense-date"
                  type="number"
                  min={1}
                  max={31}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: parseInt(e.target.value) || 1 })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending || updateMutation.isPending} data-testid="button-submit-expense">
                {editingId ? "Update" : "Add"} Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-4">
            <CardTitle className="text-base">Variable Spending</CardTitle>
            <Badge variant="secondary" data-testid="text-variable-summary">
              {formatCurrency(totalVariableActual)} / {formatCurrency(totalVariableBudget)} budget
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {variableExpenses.length > 0 ? variableExpenses.map((expense) => {
              const spent = variableActualSpending[expense.id] || 0;
              const budget = expense.cost;
              const pct = budget > 0 ? (spent / budget) * 100 : 0;
              const over = spent > budget;
              const charges = monthlyCharges?.[expense.id] ?? [];
              const isViewing = viewChargesId === expense.id;

              return (
                <div key={expense.id} data-testid={`variable-expense-${expense.id}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold">{expense.name}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${categoryColors[expense.category] || categoryColors.Other}`}>
                        {expense.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setChargeExpenseId(expense.id); setChargeOpen(true); }}
                        data-testid={`button-add-charge-${expense.id}`}
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1" />
                        Add Charge
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(expense)}
                        data-testid={`button-edit-variable-${expense.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-sm mb-1.5">
                    <span className="font-mono">
                      <span className={over ? "text-red-400" : "text-foreground"}>{formatCurrency(spent)}</span>
                      <span className="text-muted-foreground"> / {formatCurrency(budget)}</span>
                    </span>
                    <span className={`text-xs font-medium ${over ? "text-red-400" : pct > 75 ? "text-amber-400" : "text-emerald-400"}`}>
                      {over ? `${formatCurrency(spent - budget)} over` : `${formatCurrency(budget - spent)} left`}
                    </span>
                  </div>

                  <div className="h-2.5 bg-muted rounded-full">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${over ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  {charges.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setViewChargesId(isViewing ? null : expense.id)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        data-testid={`button-toggle-charges-${expense.id}`}
                      >
                        {isViewing ? "Hide" : "Show"} {charges.length} charge{charges.length !== 1 ? "s" : ""}
                      </button>
                      {isViewing && (
                        <div className="mt-2 space-y-1">
                          {charges.map((charge) => (
                            <div key={charge.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/50 text-sm" data-testid={`charge-${charge.id}`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-muted-foreground text-xs shrink-0">{charge.date}</span>
                                <span className="truncate">{charge.note}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono">{formatCurrency(charge.amount)}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => deleteChargeMutation.mutate({ expenseId: expense.id, chargeId: charge.id })}
                                  data-testid={`button-delete-charge-${charge.id}`}
                                >
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground text-center py-4">No variable spending categories.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-4">
            <CardTitle className="text-base">Fixed Expenses</CardTitle>
            <Badge variant="secondary" data-testid="text-total-monthly">
              Total: {formatCurrency(totalFixed)}/mo
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : fixedExpenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedExpenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${categoryColors[expense.category] || categoryColors.Other}`}>
                          {expense.category}
                        </span>
                      </TableCell>
                      <TableCell>{expense.date}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(expense.cost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(expense)} data-testid={`button-edit-expense-${expense.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(expense.id)} data-testid={`button-delete-expense-${expense.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No fixed expenses yet. Add your first recurring expense to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={chargeOpen} onOpenChange={(v) => { setChargeOpen(v); if (!v) { setChargeExpenseId(null); setChargeForm({ amount: 0, note: "", date: new Date().toISOString().slice(0, 10) }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Add Charge — {variableExpenses.find((e) => e.id === chargeExpenseId)?.name}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chargeExpenseId && chargeForm.amount > 0 && chargeForm.note) {
                addChargeMutation.mutate({ expenseId: chargeExpenseId, data: chargeForm });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                data-testid="input-charge-amount"
                type="number"
                step="0.01"
                value={chargeForm.amount || ""}
                onChange={(e) => setChargeForm({ ...chargeForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>What was it for?</Label>
              <Input
                data-testid="input-charge-note"
                value={chargeForm.note}
                onChange={(e) => setChargeForm({ ...chargeForm, note: e.target.value })}
                placeholder="Walmart run, dinner out, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                data-testid="input-charge-date"
                type="date"
                value={chargeForm.date}
                onChange={(e) => setChargeForm({ ...chargeForm, date: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={addChargeMutation.isPending} data-testid="button-submit-charge">
              Add Charge
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
