import fr from "@/dictionaries/fr.json";
import { type EcaTemplateText, ecaTemplate } from "./templates";

/** Test fixtures: the Studio templates rendered in French. */

const french: EcaTemplateText = (key) => fr.studio[key];

export const CRAZY_EIGHTS_LIKE = ecaTemplate("example", french);
export const MINIMAL_VALID = ecaTemplate("blank", french);
