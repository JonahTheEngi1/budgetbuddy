import { z } from "zod";

export const insertExpenseSchema = z.object({
  name: z.string().min(1),
  cost: z.number().positive(),
  category: z.string().min(1),
  date: z.number().min(1).max(31),
  isVariable: z.boolean().optional().default(false),
});

export const expenseSchema = insertExpenseSchema.extend({
  id: z.string(),
});

export const payScheduleSchema = z.object({
  interval: z.enum(["7", "14"]),
  nextPayDate: z.string(),
  payAmount: z.number().positive(),
});

export const budgetEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  category: z.string(),
  date: z.string(),
});

export const insertBudgetEntrySchema = z.object({
  name: z.string().min(1),
  cost: z.number().positive(),
  category: z.string().min(1),
  date: z.string(),
});

export const monthlyBudgetSchema = z.object({
  month: z.string(),
  income: z.number(),
  entries: z.array(budgetEntrySchema),
});

export const insertSavingsGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0),
  method: z.string().min(1),
  percentage: z.number().min(0).max(100),
});

export const savingsGoalSchema = insertSavingsGoalSchema.extend({
  id: z.string(),
});

export const variableChargeSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  note: z.string(),
  date: z.string(),
});

export const insertVariableChargeSchema = z.object({
  amount: z.number().positive(),
  note: z.string().min(1),
  date: z.string().min(1),
});

export type Expense = z.infer<typeof expenseSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type PaySchedule = z.infer<typeof payScheduleSchema>;
export type BudgetEntry = z.infer<typeof budgetEntrySchema>;
export type InsertBudgetEntry = z.infer<typeof insertBudgetEntrySchema>;
export type MonthlyBudget = z.infer<typeof monthlyBudgetSchema>;
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export const actualPaySchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  month: z.string(),
  note: z.string().optional(),
});

export const insertActualPaySchema = z.object({
  amount: z.number().positive(),
  date: z.string().min(1),
  note: z.string().optional(),
});

export type VariableCharge = z.infer<typeof variableChargeSchema>;
export type InsertVariableCharge = z.infer<typeof insertVariableChargeSchema>;
export type ActualPay = z.infer<typeof actualPaySchema>;
export type InsertActualPay = z.infer<typeof insertActualPaySchema>;

export const VARIABLE_EXPENSE_NAMES = ["Groceries", "Fun Money"] as const;

export const EXPENSE_CATEGORIES = [
  "Streaming",
  "Rent",
  "Insurance",
  "Utilities",
  "Phone",
  "Internet",
  "Groceries",
  "Fun Money",
  "Transportation",
  "Subscriptions",
  "Other",
] as const;

export const SAVINGS_METHODS = [
  "Investing",
  "Regular Savings",
  "Emergency Fund",
  "Retirement",
  "Vacation",
  "Other",
] as const;
