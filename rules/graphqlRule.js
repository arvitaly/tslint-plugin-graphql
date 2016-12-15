"use strict";
// tslint:disable max-classes-per-file ordered-imports object-literal-sort-keys
const graphql_1 = require("graphql");
const lodash_1 = require("lodash");
const tslint_1 = require("tslint");
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const graphQLValidationRuleNames = [
    "UniqueOperationNames",
    "LoneAnonymousOperation",
    "KnownTypeNames",
    "FragmentsOnCompositeTypes",
    "VariablesAreInputTypes",
    "ScalarLeafs",
    "FieldsOnCorrectType",
    "UniqueFragmentNames",
    // "KnownFragmentNames", -> any interpolation
    // "NoUnusedFragments", -> any standalone fragment
    "PossibleFragmentSpreads",
    "NoFragmentCycles",
    "UniqueVariableNames",
    "NoUndefinedVariables",
    "NoUnusedVariables",
    "KnownDirectives",
    "KnownArgumentNames",
    "UniqueArgumentNames",
    "ArgumentsOfCorrectType",
    "ProvidedNonNullArguments",
    "DefaultValuesOfCorrectType",
    "VariablesInAllowedPosition",
    "OverlappingFieldsCanBeMerged",
    "UniqueInputFieldNames",
];
// Omit these rules when in Relay env
const relayRuleNames = lodash_1.without(graphQLValidationRuleNames, "ScalarLeafs", "ProvidedNonNullArguments", "KnownDirectives", "NoUndefinedVariables");
const graphQLValidationRules = graphQLValidationRuleNames.map((ruleName) => {
    return require(`graphql/validation/rules/${ruleName}`)[ruleName];
});
const relayGraphQLValidationRules = relayRuleNames.map((ruleName) => {
    return require(`graphql/validation/rules/${ruleName}`)[ruleName];
});
class Rule extends tslint_1.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new GraphQLWalker(sourceFile, this.getOptions()));
    }
}
Rule.FAILURE_STRING = "import statement forbidden";
exports.Rule = Rule;
class GraphQLWalker extends tslint_1.RuleWalker {
    constructor(sourceFile, options) {
        super(sourceFile, options);
        this.tagRules = [];
        if (options.ruleArguments) {
            options.ruleArguments.map((optionGroup) => {
                const { schema, env, tagName } = this.parseOptions(optionGroup);
                const realEnv = typeof (env) === "undefined" ? "lokka" : env;
                this.tagRules.push({ schema, env: realEnv, tagName });
            });
        }
    }
    visitNode(node) {
        if (node.kind === ts.SyntaxKind.TaggedTemplateExpression && node.getChildren().length > 1) {
            const temp = node;
            this.tagRules.map((rule) => {
                if (templateExpressionMatchesTag(rule.tagName, node)) {
                    let query = null;
                    switch (temp.template.kind) {
                        case ts.SyntaxKind.FirstTemplateToken:
                            query = temp.template.getText();
                            break;
                        case ts.SyntaxKind.TemplateExpression:
                            const template = temp.template;
                            let currentLiteral = template.head.getText();
                            currentLiteral = currentLiteral.substr(0, currentLiteral.length - 2).replace(/\.+$/gi, "");
                            let text = currentLiteral;
                            template.templateSpans.map((span, i) => {
                                text += replaceExpression(span.expression.getText(), currentLiteral, rule.env);
                                currentLiteral = span.literal.getText();
                                currentLiteral = currentLiteral.substr(2, currentLiteral.length - 4)
                                    .replace(/\.+$/gi, "");
                                text += currentLiteral;
                            });
                            query = text + "}`";
                        default:
                    }
                    if (query !== null) {
                        this.handleTemplate(node, query.substr(1, query.length - 2), rule.schema, rule.env);
                    }
                }
            });
        }
        super.visitNode(node);
    }
    handleTemplate(node, text, schema, env) {
        if ((env === "lokka" || env === "relay") && /fragment\s+on/.test(text)) {
            text = text.replace("fragment", "fragment _");
        }
        let ast;
        try {
            ast = graphql_1.parse(text);
        }
        catch (error) {
            this.reportFailure(node, "GraphQL invalid syntax: " + error.message.split("\n")[0]);
            return;
        }
        const rules = (env === "relay" ? relayGraphQLValidationRules : graphQLValidationRules);
        const validationErrors = schema ? graphql_1.validate(schema, ast, rules) : [];
        if (validationErrors && validationErrors.length > 0) {
            this.reportFailure(node, "GraphQL validation error: " + validationErrors[0].message);
        }
    }
    parseOptions(optionGroup) {
        const { schemaJson, // Schema via JSON object
        schemaJsonFilepath, // Or Schema via absolute filepath
        env, tagName: tagNameOption, } = optionGroup;
        // Validate and unpack schema
        let schema;
        if (schemaJson) {
            schema = initSchema(schemaJson);
        }
        else if (schemaJsonFilepath) {
            const realSchemaJsonFilepath = path.resolve(schemaJsonFilepath);
            schema = initSchemaFromFile(realSchemaJsonFilepath);
        }
        else {
            throw new Error("Must pass in `schemaJson` option with schema object "
                + "or `schemaJsonFilepath` with absolute path to the json file.");
        }
        // Validate env
        if (env && env !== "lokka" && env !== "relay" && env !== "apollo") {
            throw new Error("Invalid option for env, only `apollo`, `lokka`, and `relay` supported.");
        }
        // Validate tagName and set default
        let tagName;
        if (tagNameOption) {
            tagName = tagNameOption;
        }
        else if (env === "relay") {
            tagName = "Relay.QL";
        }
        else {
            tagName = "gql";
        }
        return { schema, env, tagName };
    }
    reportFailure(node, error) {
        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), "" + error));
    }
}
function initSchema(json) {
    const unpackedSchemaJson = json.data ? json.data : json;
    if (!unpackedSchemaJson.__schema) {
        throw new Error("Please pass a valid GraphQL introspection query result.");
    }
    return graphql_1.buildClientSchema(unpackedSchemaJson);
}
function initSchemaFromFile(jsonFile) {
    return initSchema(JSON.parse(fs.readFileSync(jsonFile, "utf8")));
}
function templateExpressionMatchesTag(tagName, node) {
    const tagNameSegments = tagName.split(".").length;
    if (tagNameSegments === 1) {
        return node.getChildren()[0].kind === ts.SyntaxKind.Identifier && node.getChildren()[0].getText() === tagName;
    }
    else if (tagNameSegments === 2) {
        return node.getChildren()[0].kind === ts.SyntaxKind.PropertyAccessExpression
            && tagName ===
                node.getChildren()[0].expression.getText() + "." +
                    node.getChildren()[0].name.getText();
    }
    else {
        // We don't currently support 3 segments so ignore
        return false;
    }
}
function replaceExpression(fragment, chunk, env) {
    const nameLength = fragment.length;
    if (env === "relay") {
        // The chunk before this one had a colon at the end, so this
        // is a variable
        // Add 2 for brackets in the interpolation
        if (/:\s*$/.test(chunk)) {
            return "$" + strWithLen(nameLength + 2);
        }
        else {
            return "..." + strWithLen(nameLength);
        }
    }
    else if (env === "lokka" && /\.\.\.\s*$/.test(chunk)) {
        // This is Lokka-style fragment interpolation where you actually type the '...' yourself
        return strWithLen(nameLength + 3);
    }
    else {
        throw new Error("Invalid interpolation");
    }
}
function strWithLen(len) {
    // from 
    // http://stackoverflow.com/questions/14343844/create-a-string-of-variable-length-filled-with-a-repeated-character
    return new Array(len + 1).join("x");
}
