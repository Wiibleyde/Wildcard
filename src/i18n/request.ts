import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import enMessages from "../dictionaries/en.json";
import frMessages from "../dictionaries/fr.json";
import { routing } from "./routing";

const messages = {
    fr: frMessages,
    en: enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;

    return {
        locale,
        messages: messages[locale as keyof typeof messages],
    };
});
