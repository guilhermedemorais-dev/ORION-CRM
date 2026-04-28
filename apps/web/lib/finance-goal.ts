export interface MonthlyFinanceGoal {
    amount_cents: number;
    updated_at: string;
}

const STORAGE_PREFIX = 'orion:finance:monthly-goal';

export function getMonthlyFinanceGoalKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${STORAGE_PREFIX}:${year}-${month}`;
}

export function readMonthlyFinanceGoal(date?: Date): MonthlyFinanceGoal | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(getMonthlyFinanceGoalKey(date ?? new Date()));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as MonthlyFinanceGoal;
        if (!parsed || typeof parsed.amount_cents !== 'number' || parsed.amount_cents <= 0) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

export function writeMonthlyFinanceGoal(amountCents: number, date = new Date()): MonthlyFinanceGoal {
    const goal: MonthlyFinanceGoal = {
        amount_cents: Math.max(0, Math.trunc(amountCents)),
        updated_at: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(getMonthlyFinanceGoalKey(date), JSON.stringify(goal));
    }

    return goal;
}
