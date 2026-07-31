import { LucideIcon } from "lucide-react"

interface IconProps {
    icon: LucideIcon;
    size?: number;
    className?: string;
}

export function Icon({ icon: IconComponent, size = 18, className = "" }: IconProps) {
    return <IconComponent size={size} strokeWidth={1.6} className={className} />;
}