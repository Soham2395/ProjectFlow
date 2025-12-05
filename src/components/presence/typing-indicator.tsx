interface TypingIndicatorProps {
    message: string | null;
    className?: string;
}

export function TypingIndicator({ message, className = '' }: TypingIndicatorProps) {
    if (!message) return null;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </div>
            <span className="text-xs italic text-muted-foreground">{message}</span>
        </div>
    );
}
