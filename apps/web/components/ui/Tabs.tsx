'use client';

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
    value: string;
    setValue: (nextValue: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used inside <Tabs>.');
    }
    return context;
}

interface TabsProps {
    value?: string;
    defaultValue: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
    const [internalValue, setInternalValue] = useState<string>(value ?? defaultValue);
    const currentValue = value ?? internalValue;

    useEffect(() => {
        if (value !== undefined) {
            setInternalValue(value);
        }
    }, [value]);

    const contextValue = useMemo<TabsContextValue>(() => ({
        value: currentValue,
        setValue: (nextValue) => {
            if (value === undefined) {
                setInternalValue(nextValue);
            }
            onValueChange?.(nextValue);
        },
    }), [currentValue, onValueChange, value]);

    return (
        <TabsContext.Provider value={contextValue}>
            <div className={cn('space-y-4', className)}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'inline-flex w-full flex-wrap gap-1 rounded-lg border border-white/5 bg-[color:var(--orion-surface)] p-1 sm:w-auto',
                className
            )}
            {...props}
        />
    );
}

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
    value: string;
}

export function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
    const { value: activeValue, setValue } = useTabsContext();
    const isActive = activeValue === value;

    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition',
                isActive
                    ? 'bg-brand-gold text-[#0A0A0C]'
                    : 'text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]',
                className
            )}
            onClick={() => setValue(value)}
            {...props}
        >
            {children}
        </button>
    );
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
    value: string;
}

export function TabsContent({ className, value, children, ...props }: TabsContentProps) {
    const { value: activeValue } = useTabsContext();

    if (activeValue !== value) {
        return null;
    }

    return (
        <div role="tabpanel" className={cn('space-y-4', className)} {...props}>
            {children}
        </div>
    );
}
