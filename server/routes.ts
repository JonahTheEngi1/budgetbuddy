import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import {
  insertExpenseSchema,
  payScheduleSchema,
  insertBudgetEntrySchema,
  insertSavingsGoalSchema,
  insertActualPaySchema,
  insertVariableChargeSchema,
} from "@shared/schema";

const HARDCODED_USER = {
  username: "JonahTheEngi",
  password: "BobTheBuilder1!",
};

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.authenticated) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const MSStore = MemoryStore(session);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "budget-app-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MSStore({ checkPeriod: 86400000 }),
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (username === HARDCODED_USER.username && password === HARDCODED_USER.password) {
      req.session.authenticated = true;
      return res.json({ success: true });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/check", (req, res) => {
    res.json({ authenticated: !!req.session?.authenticated });
  });

  app.get("/api/expenses", requireAuth, (_req, res) => {
    res.json(storage.getExpenses());
  });

  app.post("/api/expenses", requireAuth, (req, res) => {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(storage.addExpense(parsed.data));
  });

  app.put("/api/expenses/:id", requireAuth, (req, res) => {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = storage.getExpenses().find((e) => e.id === req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.isVariable) {
      parsed.data.isVariable = true;
      parsed.data.name = existing.name;
    }
    const result = storage.updateExpense(req.params.id, parsed.data);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  app.delete("/api/expenses/:id", requireAuth, (req, res) => {
    const deleted = storage.deleteExpense(req.params.id);
    if (!deleted) return res.status(400).json({ message: "Cannot delete this expense" });
    res.json({ success: true });
  });

  app.get("/api/pay-schedule", requireAuth, (_req, res) => {
    res.json(storage.getPaySchedule());
  });

  app.post("/api/pay-schedule", requireAuth, (req, res) => {
    const parsed = payScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    storage.savePaySchedule(parsed.data);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyIncome = parsed.data.payAmount * (parsed.data.interval === "7" ? 4 : 2);
    const existing = storage.getBudget(currentMonth);
    if (existing) {
      storage.createOrUpdateBudget(currentMonth, monthlyIncome);
    }
    res.json(parsed.data);
  });

  app.get("/api/budget-history", requireAuth, (_req, res) => {
    res.json(storage.getBudgetHistory());
  });

  app.post("/api/budget/auto-generate", requireAuth, (_req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existing = storage.getBudget(currentMonth);
    if (existing) {
      return res.json({ created: false, budget: existing });
    }
    const paySchedule = storage.getPaySchedule();
    const income = paySchedule ? paySchedule.payAmount * (paySchedule.interval === "7" ? 4 : 2) : 0;
    const budget = storage.createOrUpdateBudget(currentMonth, income);
    res.json({ created: true, budget });
  });

  app.get("/api/budget/:month", requireAuth, (req, res) => {
    const budget = storage.getBudget(req.params.month);
    if (!budget) return res.status(404).json({ message: "No budget for this month" });
    res.json(budget);
  });

  app.post("/api/budget/:month", requireAuth, (req, res) => {
    const { income } = req.body;
    if (typeof income !== "number" || income < 0) {
      return res.status(400).json({ message: "Invalid income" });
    }
    res.json(storage.createOrUpdateBudget(req.params.month, income));
  });

  app.post("/api/budget/:month/entries", requireAuth, (req, res) => {
    const parsed = insertBudgetEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = storage.addBudgetEntry(req.params.month, parsed.data);
    if (!entry) return res.status(404).json({ message: "Budget not found" });
    res.json(entry);
  });

  app.delete("/api/budget/:month/entries/:entryId", requireAuth, (req, res) => {
    const deleted = storage.deleteBudgetEntry(req.params.month, req.params.entryId);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/variable-charges", requireAuth, (_req, res) => {
    res.json(storage.getAllVariableCharges());
  });

  app.get("/api/variable-charges/:month", requireAuth, (req, res) => {
    res.json(storage.getVariableChargesForMonth(req.params.month));
  });

  app.get("/api/variable-charges/:month/:expenseId", requireAuth, (req, res) => {
    res.json(storage.getVariableCharges(req.params.month, req.params.expenseId));
  });

  app.post("/api/variable-charges/:month/:expenseId", requireAuth, (req, res) => {
    const parsed = insertVariableChargeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const charge = storage.addVariableCharge(req.params.month, req.params.expenseId, parsed.data);
    res.json(charge);
  });

  app.delete("/api/variable-charges/:month/:expenseId/:chargeId", requireAuth, (req, res) => {
    const deleted = storage.deleteVariableCharge(req.params.month, req.params.expenseId, req.params.chargeId);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/savings-goals", requireAuth, (_req, res) => {
    res.json(storage.getSavingsGoals());
  });

  app.post("/api/savings-goals", requireAuth, (req, res) => {
    const parsed = insertSavingsGoalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(storage.addSavingsGoal(parsed.data));
  });

  app.put("/api/savings-goals/:id", requireAuth, (req, res) => {
    const result = storage.updateSavingsGoal(req.params.id, req.body);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  app.delete("/api/savings-goals/:id", requireAuth, (req, res) => {
    const deleted = storage.deleteSavingsGoal(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/actual-pay", requireAuth, (_req, res) => {
    res.json(storage.getActualPay());
  });

  app.get("/api/actual-pay/:month", requireAuth, (req, res) => {
    res.json(storage.getActualPayForMonth(req.params.month));
  });

  app.post("/api/actual-pay", requireAuth, (req, res) => {
    const parsed = insertActualPaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(storage.addActualPay(parsed.data));
  });

  app.delete("/api/actual-pay/:id", requireAuth, (req, res) => {
    const deleted = storage.deleteActualPay(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  return httpServer;
}
