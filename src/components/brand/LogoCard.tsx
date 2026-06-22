import { GOLD_GRADIENT } from "@/lib/ui/brand";

type Props = {
    className?: string;
    boxShadow?: string;
};

export function LogoCard({
    className = "w-20 h-20",
    boxShadow = "0 0 48px rgba(245,197,22,0.3), 0 6px 0 0 #7a5a00",
}: Props) {
    return (
        <div
            className={`${className} rounded-2xl flex items-center justify-center font-black text-4xl`}
            style={{
                background: GOLD_GRADIENT,
                color: "#0d0a05",
                boxShadow,
            }}
        >
            W
        </div>
    );
}
