import { IconSvg } from "./IconSvg";

export function HomeIcon() {
    return (
        <IconSvg>
            <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
        </IconSvg>
    );
}

export function PlayIcon() {
    return (
        <IconSvg>
            <path d="M8 5v14l11-7z" />
        </IconSvg>
    );
}

export function ShopIcon() {
    return (
        <IconSvg>
            <path d="M4 7h16l-1 13H5L4 7zm3 0a5 5 0 0 1 10 0" />
        </IconSvg>
    );
}

export function ShieldIcon() {
    return (
        <IconSvg>
            <path d="M12 3 5 6v5c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3z" />
            <path d="m9 12 2 2 4-4" />
        </IconSvg>
    );
}

export function PaletteIcon() {
    return (
        <IconSvg>
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </IconSvg>
    );
}
