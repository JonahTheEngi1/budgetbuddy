import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Calendar, ChevronRight, ShoppingCart } from "lucide-react";
import type { MonthlyBudget, Expense, VariableCharge, ActualPay } from "@shared/schema";

type AllVariableCharges = Record<string, Record<string, VariableCharge[]>>;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string) {
  const d = new Date(month + "-01");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function BudgetPage() {
  const currentMonth = getCurrentMonth();

  const { data: budgetHistory, isLoading: loadingHistory } = useQuery<MonthlyBudget[]>({
    queryKey: ["/api/budget-history"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: allCharges } = useQuery<AllVariableCharges>({
    queryKey: ["/api/variable-charges"],
  });

  const { data: allActualPay } = useQuery<ActualPay[]>({
    queryKey: ["/api/actual-pay"],
  });

  const pastMonths = (budgetHistory ?? [])
    .filter((b) => b.month < currentMonth)
    .sort((a, b) => b.month.localeCompare(a.month));

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? (pastMonths.length > 0 ? pastMonths[0].month : null);
  const selectedBudget = activeMonth ? budgetHistory?.find((b) => b.month === activeMonth) : null;

  const variableExpenses = expenses?.filter((e) => e.isVariable) ?? [];

  const monthCharges = activeMonth ? (allCharges?.[activeMonth] ?? {}) : {};
  const variableSpending: Record<string, number> = {};
  let totalVariableActual = 0;
  for (const ve of variableExpenses) {
    const charges = monthCharges[ve.id] ?? [];
    const spent = charges.reduce((s, c) => s + c.amount, 0);
    variableSpending[ve.id] = spent;
    totalVariableActual += spent;
  }

  const fixedExpensesTotal = selectedBudget?.entries.reduce((s, e) => s + e.cost, 0) ?? 0;
  const totalExpenses = fixedExpensesTotal + totalVariableActual;

  function getMonthActualPay(month: string): number {
    return (allActualPay ?? []).filter((p) => p.month === month).reduce((s, p) => s + p.amount, 0);
  }

  function getMonthVariableTotal(month: string): number {
    const mc = allCharges?.[month] ?? {};
    let total = 0;
    for (const charges of Object.values(mc)) {
      total += charges.reduce((s, c) => s + c.amount, 0);
    }
    return total;
  }

  const monthActualPay = activeMonth ? getMonthActualPay(activeMonth) : 0;
  const income = selectedBudget ? (monthActualPay > 0 ? monthActualPay : selectedBudget.income) : 0;
  const remaining = income - totalExpenses;

  const historyChartData = pastMonths
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map((b) => {
      const actualPay = getMonthActualPay(b.month);
      const totalExp = b.entries.reduce((s, e) => s + e.cost, 0) + getMonthVariableTotal(b.month);
      const inc = actualPay > 0 ? actualPay : b.income;
      return {
        month: new Date(b.month + "-01").toLocaleDateString("en-US", { month: "short" }),
        income: inc,
        expenses: totalExp,
        net: inc - totalExp,
      };
    });

  if (loadingHistory) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (pastMonths.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-history-title">History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View past monthly budgets and spending
          </p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1" data-testid="text-no-history">No history yet</h3>
            <p className="text-sm text-muted-foreground">
              Completed months will appear here once a new month begins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-history-title">History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View past monthly budgets and spending
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          {selectedBudget && (
            <>
              <h2 className="text-lg font-semibold" data-testid="text-selected-month">{formatMonth(activeMonth!)}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1" data-testid="text-budget-income">{formatCurrency(income)}</p>
                    {monthActualPay > 0 && monthActualPay !== selectedBudget.income && (
                      <p className="text-xs text-muted-foreground mt-0.5">Est. {formatCurrency(selectedBudget.income)}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Fixed</p>
                    <p className="text-xl font-bold text-red-400 mt-1" data-testid="text-budget-fixed">{formatCurrency(fixedExpensesTotal)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Variable</p>
                    <p className="text-xl font-bold text-amber-400 mt-1" data-testid="text-budget-variable">{formatCurrency(totalVariableActual)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={`text-xl font-bold mt-1 ${remaining >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-budget-remaining">
                      {formatCurrency(remaining)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {variableExpenses.length > 0 && totalVariableActual > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Variable Spending
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {variableExpenses.map((ve) => {
                      const spent = variableSpending[ve.id] || 0;
                      if (spent === 0) return null;
                      const budget = ve.cost;
                      const pct = budget > 0 ? (spent / budget) * 100 : 0;
                      const over = spent > budget;

                      return (
                        <div key={ve.id} data-testid={`history-variable-${ve.id}`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm">{ve.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(spent)} / {formatCurrency(budget)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mb-1">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${over ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">{(monthCharges[ve.id] ?? []).length} charges</span>
                            <span className={over ? "text-red-400 font-medium" : "text-emerald-400"}>
                              {over ? `${formatCurrency(spent - budget)} over budget` : `${formatCurrency(budget - spent)} under budget`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">{formatMonth(activeMonth!)} Fixed Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedBudget.entries.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBudget.entries.map((entry) => (
                          <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                            <TableCell className="font-medium">{entry.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{entry.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{entry.date}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(entry.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No fixed expenses recorded for this month.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {historyChartData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={historyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 5%, 20%)" />
                    <XAxis dataKey="month" stroke="hsl(217, 8%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(217, 8%, 55%)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(217, 5%, 12%)", border: "1px solid hsl(217, 5%, 20%)", borderRadius: "8px" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="income" fill="hsl(172, 66%, 50%)" radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="expenses" fill="hsl(340, 75%, 55%)" radius={[4, 4, 0, 0]} name="Expenses" />
                    <Bar dataKey="net" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Net" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Past Months</h2>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2 pr-2">
              {pastMonths.map((budget) => {
                const exp = budget.entries.reduce((s, e) => s + e.cost, 0);
                const isSelected = budget.month === activeMonth;
                return (
                  <Card
                    key={budget.month}
                    className={`cursor-pointer transition-colors ${isSelected ? "border-primary" : ""}`}
                    onClick={() => setSelectedMonth(budget.month)}
                    data-testid={`card-history-${budget.month}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="font-medium text-sm">{formatMonth(budget.month)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <span className="text-emerald-400">{formatCurrency(budget.income)}</span>
                        <span className="text-red-400">{formatCurrency(exp)}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full">
                        <div
                          className={`h-full rounded-full transition-all ${exp > budget.income ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${Math.min((exp / (budget.income || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
