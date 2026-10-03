import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/base/alert";
import { cn } from "@/lib/utils";

export function ErrorBanner({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <Alert
            className={cn(
                "border-nb bg-wc-red font-bold text-wc-accent-ink",
                className,
            )}
        >
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="font-bold">
                {children}
            </AlertDescription>
        </Alert>
    );
}
