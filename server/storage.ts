import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  Expense,
  InsertExpense,
  PaySchedule,
  MonthlyBudget,
  BudgetEntry,
  InsertBudgetEntry,
  SavingsGoal,
  InsertSavingsGoal,
  VariableCharge,
  InsertVariableCharge,
  ActualPay,
  InsertActualPay,
} from "@shared/schema";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch {
    return defaultValue;
  }
}

function writeJSON<T>(filename: string, data: T): void {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

type VariableChargesData = Record<string, Record<string, VariableCharge[]>>;

export class JsonStorage {
  getExpenses(): Expense[] {
    return readJSON<Expense[]>("expenses.json", []);
  }

  saveExpenses(expenses: Expense[]): void {
    writeJSON("expenses.json", expenses);
  }

  addExpense(data: InsertExpense): Expense {
    const expenses = this.getExpenses();
    const expense: Expense = { ...data, id: randomUUID() };
    expenses.push(expense);
    this.saveExpenses(expenses);
    return expense;
  }

  updateExpense(id: string, data: Partial<InsertExpense>): Expense | undefined {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) return undefined;
    expenses[idx] = { ...expenses[idx], ...data, id };
    this.saveExpenses(expenses);
    return expenses[idx];
  }

  deleteExpense(id: string): boolean {
    const expenses = this.getExpenses();
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return false;
    if (expense.isVariable) return false;
    const filtered = expenses.filter((e) => e.id !== id);
    this.saveExpenses(filtered);
    return true;
  }

  getPaySchedule(): PaySchedule | null {
    return readJSON<PaySchedule | null>("pay-schedule.json", null);
  }

  savePaySchedule(schedule: PaySchedule): void {
    writeJSON("pay-schedule.json", schedule);
  }

  getBudgetHistory(): MonthlyBudget[] {
    return readJSON<MonthlyBudget[]>("budget-history.json", []);
  }

  saveBudgetHistory(history: MonthlyBudget[]): void {
    writeJSON("budget-history.json", history);
  }

  getBudget(month: string): MonthlyBudget | undefined {
    const history = this.getBudgetHistory();
    return history.find((b) => b.month === month);
  }

  createOrUpdateBudget(month: string, income: number): MonthlyBudget {
    const history = this.getBudgetHistory();
    let budget = history.find((b) => b.month === month);
    if (!budget) {
      const expenses = this.getExpenses();
      const entries: BudgetEntry[] = expenses
        .filter((e) => !e.isVariable)
        .map((e) => ({
          id: randomUUID(),
          name: e.name,
          cost: e.cost,
          category: e.category,
          date: `${month}-${String(e.date).padStart(2, "0")}`,
        }));
      budget = { month, income, entries };
      history.push(budget);
    } else {
      budget.income = income;
    }
    this.saveBudgetHistory(history);
    return budget;
  }

  addBudgetEntry(month: string, data: InsertBudgetEntry): BudgetEntry | undefined {
    const history = this.getBudgetHistory();
    const budget = history.find((b) => b.month === month);
    if (!budget) return undefined;
    const entry: BudgetEntry = { ...data, id: randomUUID() };
    budget.entries.push(entry);
    this.saveBudgetHistory(history);
    return entry;
  }

  deleteBudgetEntry(month: string, entryId: string): boolean {
    const history = this.getBudgetHistory();
    const budget = history.find((b) => b.month === month);
    if (!budget) return false;
    const len = budget.entries.length;
    budget.entries = budget.entries.filter((e) => e.id !== entryId);
    if (budget.entries.length === len) return false;
    this.saveBudgetHistory(history);
    return true;
  }

  getSavingsGoals(): SavingsGoal[] {
    return readJSON<SavingsGoal[]>("savings-goals.json", []);
  }

  saveSavingsGoals(goals: SavingsGoal[]): void {
    writeJSON("savings-goals.json", goals);
  }

  addSavingsGoal(data: InsertSavingsGoal): SavingsGoal {
    const goals = this.getSavingsGoals();
    const goal: SavingsGoal = { ...data, id: randomUUID() };
    goals.push(goal);
    this.saveSavingsGoals(goals);
    return goal;
  }

  updateSavingsGoal(id: string, data: Partial<InsertSavingsGoal>): SavingsGoal | undefined {
    const goals = this.getSavingsGoals();
    const idx = goals.findIndex((g) => g.id === id);
    if (idx === -1) return undefined;
    goals[idx] = { ...goals[idx], ...data };
    this.saveSavingsGoals(goals);
    return goals[idx];
  }

  deleteSavingsGoal(id: string): boolean {
    const goals = this.getSavingsGoals();
    const filtered = goals.filter((g) => g.id !== id);
    if (filtered.length === goals.length) return false;
    this.saveSavingsGoals(filtered);
    return true;
  }

  getAllVariableCharges(): VariableChargesData {
    return readJSON<VariableChargesData>("variable-charges.json", {});
  }

  saveAllVariableCharges(data: VariableChargesData): void {
    writeJSON("variable-charges.json", data);
  }

  getVariableCharges(month: string, expenseId: string): VariableCharge[] {
    const all = this.getAllVariableCharges();
    return all[month]?.[expenseId] ?? [];
  }

  getVariableChargesForMonth(month: string): Record<string, VariableCharge[]> {
    const all = this.getAllVariableCharges();
    return all[month] ?? {};
  }

  addVariableCharge(month: string, expenseId: string, data: InsertVariableCharge): VariableCharge {
    const all = this.getAllVariableCharges();
    if (!all[month]) all[month] = {};
    if (!all[month][expenseId]) all[month][expenseId] = [];
    const charge: VariableCharge = { ...data, id: randomUUID() };
    all[month][expenseId].push(charge);
    this.saveAllVariableCharges(all);
    return charge;
  }

  deleteVariableCharge(month: string, expenseId: string, chargeId: string): boolean {
    const all = this.getAllVariableCharges();
    if (!all[month]?.[expenseId]) return false;
    const len = all[month][expenseId].length;
    all[month][expenseId] = all[month][expenseId].filter((c) => c.id !== chargeId);
    if (all[month][expenseId].length === len) return false;
    this.saveAllVariableCharges(all);
    return true;
  }

  getActualPay(): ActualPay[] {
    return readJSON<ActualPay[]>("actual-pay.json", []);
  }

  saveActualPay(records: ActualPay[]): void {
    writeJSON("actual-pay.json", records);
  }

  addActualPay(data: InsertActualPay): ActualPay {
    const records = this.getActualPay();
    const month = data.date.slice(0, 7);
    const record: ActualPay = { ...data, id: randomUUID(), month };
    records.push(record);
    this.saveActualPay(records);
    return record;
  }

  deleteActualPay(id: string): boolean {
    const records = this.getActualPay();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    this.saveActualPay(filtered);
    return true;
  }

  getActualPayForMonth(month: string): ActualPay[] {
    return this.getActualPay().filter((r) => r.month === month);
  }
}

export const storage = new JsonStorage();
