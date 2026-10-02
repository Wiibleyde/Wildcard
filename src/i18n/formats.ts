import type { Formats } from "next-intl";

export const formats = {
    dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        monthYear: { month: "long", year: "numeric" },
    },
} satisfies Formats;
