import { CRAZY_EIGHTS_LIKE, MINIMAL_VALID } from "./fixtures";
import {
    buildRuleContext,
    cardRankValue,
    type EcaRuleContext,
    evaluateCondition,
    evaluateOperand,
    firstMatchingRule,
    matchingRules,
    ruleHasEffect,
    ruleMatches,
    topOfDiscard,
} from "./interpreter";
import { createEcaModule } from "./module";
import {
    ECA_DEFINITION_VERSION,
    type EcaAction,
    type EcaCardProp,
    type EcaComparator,
    type EcaCondition,
    type EcaDeckId,
    type EcaDefinition,
    type EcaEffect,
    type EcaEventType,
    type EcaOperand,
    type EcaPlayerView,
    type EcaRule,
    type EcaState,
    type EcaView,
} from "./types";
import {
    ECA_CONDITIONS_MAX,
    ECA_DESCRIPTION_MAX,
    ECA_DRAW_COUNT_MAX,
    ECA_DRAW_COUNT_MIN,
    ECA_EFFECTS_MAX,
    ECA_EFFECTS_MIN,
    ECA_HAND_SIZE_MAX,
    ECA_HAND_SIZE_MIN,
    ECA_NAME_MAX,
    ECA_NAME_MIN,
    ECA_PLAYERS_MAX,
    ECA_PLAYERS_MIN,
    ECA_RULE_NAME_MAX,
    ECA_RULES_MAX,
    ECA_RULES_MIN,
    type EcaValidationError,
    type EcaValidationResult,
    validateEcaDefinition,
} from "./validate";

/**
 * Public surface of the ECA engine (`@/lib/eca`) — explicit import/export
 * pairs rather than `export … from`, per this repo's `noBarrelFile` lint rule.
 */

export {
    // definition schema
    ECA_DEFINITION_VERSION,
    // validation
    validateEcaDefinition,
    ECA_NAME_MIN,
    ECA_NAME_MAX,
    ECA_DESCRIPTION_MAX,
    ECA_PLAYERS_MIN,
    ECA_PLAYERS_MAX,
    ECA_HAND_SIZE_MIN,
    ECA_HAND_SIZE_MAX,
    ECA_RULES_MIN,
    ECA_RULES_MAX,
    ECA_CONDITIONS_MAX,
    ECA_EFFECTS_MIN,
    ECA_EFFECTS_MAX,
    ECA_DRAW_COUNT_MIN,
    ECA_DRAW_COUNT_MAX,
    ECA_RULE_NAME_MAX,
    // interpreter
    evaluateOperand,
    evaluateCondition,
    ruleMatches,
    firstMatchingRule,
    matchingRules,
    ruleHasEffect,
    cardRankValue,
    topOfDiscard,
    buildRuleContext,
    // module factory
    createEcaModule,
    // fixtures / templates
    CRAZY_EIGHTS_LIKE,
    MINIMAL_VALID,
};

export type {
    EcaAction,
    EcaCardProp,
    EcaComparator,
    EcaCondition,
    EcaDeckId,
    EcaDefinition,
    EcaEffect,
    EcaEventType,
    EcaOperand,
    EcaPlayerView,
    EcaRule,
    EcaRuleContext,
    EcaState,
    EcaValidationError,
    EcaValidationResult,
    EcaView,
};
