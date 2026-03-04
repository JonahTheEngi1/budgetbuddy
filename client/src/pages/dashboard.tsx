import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  PieChart, Pie,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Pencil, Banknote, Trash2, PiggyBank } from "lucide-react";
import { PayScheduleSetup } from "@/components/pay-schedule-modal";
import { useToast } from "@/hooks/use-toast";
import type { MonthlyBudget, PaySchedule, SavingsGoal, Expense, VariableCharge, ActualPay } from "@shared/schema";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(172, 66%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(32, 95%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(45, 90%, 50%)",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthTitle(month: string) {
  const d = new Date(month + "-01");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [payEditOpen, setPayEditOpen] = useState(false);
  const [gotPaidOpen, setGotPaidOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [showPayHistory, setShowPayHistory] = useState(false);
  const currentMonth = getCurrentMonth();

  const { data: budgetHistory, isLoading: loadingBudgets } = useQuery<MonthlyBudget[]>({
    queryKey: ["/api/budget-history"],
  });

  const { data: paySchedule, isLoading: loadingPay } = useQuery<PaySchedule | null>({
    queryKey: ["/api/pay-schedule"],
  });

  const { data: savingsGoals, isLoading: loadingSavings } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: monthlyCharges } = useQuery<Record<string, VariableCharge[]>>({
    queryKey: ["/api/variable-charges", currentMonth],
  });

  const { data: allActualPay } = useQuery<ActualPay[]>({
    queryKey: ["/api/actual-pay"],
  });

  const addPayMutation = useMutation({
    mutationFn: async (data: { amount: number; date: string; note?: string }) => {
      const res = await apiRequest("POST", "/api/actual-pay", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actual-pay"] });
      setGotPaidOpen(false);
      setPaidAmount("");
      setPaidNote("");
      setPaidDate(new Date().toISOString().slice(0, 10));
      toast({ title: "Pay recorded!" });
    },
  });

  const deletePayMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/actual-pay/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actual-pay"] });
      toast({ title: "Pay record removed" });
    },
  });

  const isLoading = loadingBudgets || loadingPay || loadingSavings || loadingExpenses;

  const currentBudget = budgetHistory?.find((b) => b.month === currentMonth);
  const fixedExpenses = expenses?.filter((e) => !e.isVariable) ?? [];
  const variableExpenses = expenses?.filter((e) => e.isVariable) ?? [];

  let variableActualTotal = 0;
  const variableCategorySpending: Record<string, number> = {};
  for (const ve of variableExpenses) {
    const charges = monthlyCharges?.[ve.id] ?? [];
    const spent = charges.reduce((s, c) => s + c.amount, 0);
    variableActualTotal += spent;
    variableCategorySpending[ve.category] = (variableCategorySpending[ve.category] || 0) + spent;
  }

  const totalEstimatedIncome = currentBudget?.income ?? 0;
  const currentMonthActualPay = (allActualPay ?? []).filter((p) => p.month === currentMonth);
  const totalActualIncome = currentMonthActualPay.reduce((s, p) => s + p.amount, 0);
  const hasActualPay = currentMonthActualPay.length > 0;

  const fixedExpensesTotal = fixedExpenses.reduce((s, e) => s + e.cost, 0);
  const variableBudgetTotal = variableExpenses.reduce((s, e) => s + e.cost, 0);
  const totalActualExpenses = fixedExpensesTotal + variableActualTotal;
  const totalBudgetedExpenses = fixedExpensesTotal + variableBudgetTotal;

  const incomeForCalc = hasActualPay ? totalActualIncome : totalEstimatedIncome;
  const remaining = incomeForCalc - totalActualExpenses;

  const expectedSavings = totalEstimatedIncome - totalBudgetedExpenses;
  const actualSavings = incomeForCalc - totalActualExpenses;

  const overviewChartData = [
    {
      label: "Income",
      estimated: totalEstimatedIncome,
      actual: hasActualPay ? totalActualIncome : null,
    },
    {
      label: "Savings",
      estimated: expectedSavings,
      actual: hasActualPay ? actualSavings : null,
    },
  ];

  const categoryMap: Record<string, number> = {};
  fixedExpenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.cost;
  });
  variableExpenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.cost;
  });
  const donutData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-72 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PayScheduleSetup externalOpen={payEditOpen} onExternalClose={() => setPayEditOpen(false)} />

      <Dialog open={gotPaidOpen} onOpenChange={(v) => { setGotPaidOpen(v); if (!v) { setPaidAmount(""); setPaidNote(""); setPaidDate(new Date().toISOString().slice(0, 10)); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-400" />
              I Got Paid!
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = parseFloat(paidAmount);
              if (amount > 0 && paidDate) {
                addPayMutation.mutate({ amount, date: paidDate, note: paidNote || undefined });
              }
            }}
            className="space-y-4"
          >
            {paySchedule && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Estimated per check: </span>
                <span className="font-semibold">{formatCurrency(paySchedule.payAmount)}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Actual Amount Received</Label>
              <Input
                data-testid="input-actual-pay-amount"
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={paySchedule ? String(paySchedule.payAmount) : "0.00"}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                data-testid="input-actual-pay-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                data-testid="input-actual-pay-note"
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                placeholder="e.g. Regular paycheck, overtime, bonus"
              />
            </div>
            <Button type="submit" className="w-full" disabled={addPayMutation.isPending} data-testid="button-submit-actual-pay">
              Record Pay
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">{formatMonthTitle(currentMonth)}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {paySchedule ? `Next pay: ${new Date(paySchedule.nextPayDate).toLocaleDateString()}` : "Configure your pay schedule to get started"}
          </p>
        </div>
        <Button
          onClick={() => setGotPaidOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="button-got-paid"
        >
          <Banknote className="w-4 h-4 mr-2" />
          I Got Paid
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer transition-colors hover:border-primary group"
          onClick={() => setPayEditOpen(true)}
          data-testid="card-monthly-income"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Monthly Income</p>
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            {hasActualPay ? (
              <>
                <p className="text-2xl font-bold mt-2 text-emerald-400" data-testid="text-stat-monthly-income">
                  {formatCurrency(totalActualIncome)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actual ({currentMonthActualPay.length} check{currentMonthActualPay.length !== 1 ? "s" : ""}) · Est. {formatCurrency(totalEstimatedIncome)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-2" data-testid="text-stat-monthly-income">
                  {formatCurrency(totalEstimatedIncome)}
                </p>
                {paySchedule && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(paySchedule.payAmount)}/check · {paySchedule.interval === "7" ? "Weekly" : "Bi-weekly"}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-stat-total-expenses">
              {formatCurrency(totalActualExpenses)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(fixedExpensesTotal)} fixed · {formatCurrency(variableActualTotal)} variable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <TrendingUp className={`w-4 h-4 ${remaining >= 0 ? "text-emerald-400" : "text-red-400"}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${remaining >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-stat-remaining">
              {formatCurrency(remaining)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              After all spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-muted-foreground">Savings</p>
              <PiggyBank className={`w-4 h-4 ${actualSavings >= expectedSavings ? "text-emerald-400" : "text-amber-400"}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${actualSavings >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-stat-savings">
              {formatCurrency(actualSavings)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected: {formatCurrency(expectedSavings)}
            </p>
          </CardContent>
        </Card>
      </div>

      {currentMonthActualPay.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium">Paychecks This Month</p>
              <button
                onClick={() => setShowPayHistory(!showPayHistory)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                data-testid="button-toggle-pay-history"
              >
                {showPayHistory ? "Hide" : "Show"} details
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400 font-mono font-semibold">{formatCurrency(totalActualIncome)}</span>
              <span className="text-muted-foreground">actual</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-mono">{formatCurrency(totalEstimatedIncome)}</span>
              <span className="text-muted-foreground">estimated</span>
              {totalActualIncome !== totalEstimatedIncome && (
                <span className={`text-xs font-medium ${totalActualIncome > totalEstimatedIncome ? "text-emerald-400" : "text-red-400"}`}>
                  ({totalActualIncome > totalEstimatedIncome ? "+" : ""}{formatCurrency(totalActualIncome - totalEstimatedIncome)})
                </span>
              )}
            </div>
            {showPayHistory && (
              <div className="mt-3 space-y-1.5">
                {currentMonthActualPay.map((pay) => (
                  <div key={pay.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/50 text-sm" data-testid={`pay-record-${pay.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground text-xs shrink-0">{pay.date}</span>
                      <span className="truncate">{pay.note || "Paycheck"}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-emerald-400">{formatCurrency(pay.amount)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => deletePayMutation.mutate(pay.id)}
                        data-testid={`button-delete-pay-${pay.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estimated vs Actual</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overviewChartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 5%, 20%)" />
                <XAxis dataKey="label" stroke="hsl(217, 8%, 55%)" fontSize={13} />
                <YAxis stroke="hsl(217, 8%, 55%)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(217, 5%, 12%)", border: "1px solid hsl(217, 5%, 20%)", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(217, 5%, 80%)" }}
                  formatter={(value: number | null) => value !== null ? formatCurrency(value) : "N/A"}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="estimated" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Estimated" />
                <Bar dataKey="actual" fill="hsl(172, 66%, 50%)" radius={[4, 4, 0, 0]} name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(217, 5%, 12%)", border: "1px solid hsl(217, 5%, 20%)", borderRadius: "8px" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                No expenses to display.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {variableExpenses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Variable Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {variableExpenses.map((ve) => {
                const charges = monthlyCharges?.[ve.id] ?? [];
                const spent = charges.reduce((s, c) => s + c.amount, 0);
                const budget = ve.cost;
                const pct = budget > 0 ? (spent / budget) * 100 : 0;
                const over = spent > budget;

                return (
                  <div key={ve.id} data-testid={`variable-spending-${ve.id}`}>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <p className="text-sm font-medium" data-testid={`text-variable-name-${ve.id}`}>{ve.name}</p>
                      <span className={`text-xs font-medium ${over ? "text-red-400" : "text-emerald-400"}`}>
                        {over ? `${formatCurrency(spent - budget)} over` : `${formatCurrency(budget - spent)} left`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-sm mb-1.5">
                      <span className="font-mono">{formatCurrency(spent)}</span>
                      <span className="text-muted-foreground">/ {formatCurrency(budget)}</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {savingsGoals && savingsGoals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Savings Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savingsGoals.map((goal) => {
                const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                  <div key={goal.id} className="space-y-2" data-testid={`savings-goal-${goal.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" data-testid={`text-goal-name-${goal.id}`}>{goal.name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
