"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable max-classes-per-file ordered-imports object-literal-sort-keys
var graphql_1 = require("graphql");
var lodash_1 = require("lodash");
var tslint_1 = require("tslint");
var ts = require("typescript");
var fs = require("fs");
var path = require("path");
var graphQLValidationRuleNames = [
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
var relayRuleNames = lodash_1.without(graphQLValidationRuleNames, "ScalarLeafs", "ProvidedNonNullArguments", "KnownDirectives", "NoUndefinedVariables");
var graphQLValidationRules = graphQLValidationRuleNames.map(function (ruleName) {
    return require("graphql/validation/rules/" + ruleName)[ruleName];
});
var relayGraphQLValidationRules = relayRuleNames.map(function (ruleName) {
    return require("graphql/validation/rules/" + ruleName)[ruleName];
});
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new GraphQLWalker(sourceFile, this.getOptions()));
    };
    Rule.FAILURE_STRING = "import statement forbidden";
    return Rule;
}(tslint_1.Rules.AbstractRule));
exports.Rule = Rule;
var GraphQLWalker = /** @class */ (function (_super) {
    __extends(GraphQLWalker, _super);
    function GraphQLWalker(sourceFile, options) {
        var _this = _super.call(this, sourceFile, options) || this;
        _this.tagRules = [];
        if (options.ruleArguments) {
            options.ruleArguments.map(function (optionGroup) {
                var _a = _this.parseOptions(optionGroup), schema = _a.schema, env = _a.env, tagName = _a.tagName;
                var realEnv = typeof (env) === "undefined" ? "lokka" : env;
                _this.tagRules.push({ schema: schema, env: realEnv, tagName: tagName });
            });
        }
        return _this;
    }
    GraphQLWalker.prototype.visitNode = function (node) {
        var _this = this;
        if (node.kind === ts.SyntaxKind.TaggedTemplateExpression && node.getChildren().length > 1) {
            var temp_1 = node;
            this.tagRules.map(function (rule) {
                if (templateExpressionMatchesTag(rule.tagName, node)) {
                    var query = null;
                    switch (temp_1.template.kind) {
                        case ts.SyntaxKind.FirstTemplateToken:
                            query = temp_1.template.getText();
                            break;
                        case ts.SyntaxKind.TemplateExpression:
                            var template = temp_1.template;
                            var currentLiteral_1 = template.head.getText();
                            currentLiteral_1 = currentLiteral_1.substr(0, currentLiteral_1.length - 2).replace(/\.+$/gi, "");
                            var text_1 = currentLiteral_1;
                            template.templateSpans.map(function (span) {
                                text_1 += replaceExpression(span.expression.getText(), currentLiteral_1, rule.env);
                                currentLiteral_1 = span.literal.getText();
                                currentLiteral_1 = currentLiteral_1.substr(2, currentLiteral_1.length - 4)
                                    .replace(/\.+$/gi, "");
                                text_1 += currentLiteral_1;
                            });
                            query = text_1 + "}`";
                            break;
                    }
                    if (query !== null) {
                        _this.handleTemplate(node, query.substr(1, query.length - 2), rule.schema, rule.env);
                    }
                }
            });
        }
        _super.prototype.visitNode.call(this, node);
    };
    GraphQLWalker.prototype.handleTemplate = function (node, text, schema, env) {
        if ((env === "lokka" || env === "relay") && /fragment\s+on/.test(text)) {
            text = text.replace("fragment", "fragment _");
        }
        var ast;
        try {
            ast = graphql_1.parse(text);
        }
        catch (error) {
            this.reportFailure(node, "GraphQL invalid syntax: " + error.message.split("\n")[0]);
            return;
        }
        var rules = (env === "relay" ? relayGraphQLValidationRules : graphQLValidationRules);
        var validationErrors = schema ? graphql_1.validate(schema, ast, rules) : [];
        if (validationErrors && validationErrors.length > 0) {
            this.reportFailure(node, "GraphQL validation error: " + validationErrors[0].message);
        }
    };
    GraphQLWalker.prototype.parseOptions = function (optionGroup) {
        var schemaJson = optionGroup.schemaJson, // Schema via JSON object
        schemaJsonFilepath = optionGroup.schemaJsonFilepath, // Or Schema via absolute filepath
        env = optionGroup.env, tagNameOption = optionGroup.tagName;
        // Validate and unpack schema
        var schema;
        if (schemaJson) {
            schema = initSchema(schemaJson);
        }
        else if (schemaJsonFilepath) {
            var realSchemaJsonFilepath = path.resolve(schemaJsonFilepath);
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
        var tagName;
        if (tagNameOption) {
            tagName = tagNameOption;
        }
        else if (env === "relay") {
            tagName = "Relay.QL";
        }
        else {
            tagName = "gql";
        }
        return { schema: schema, env: env, tagName: tagName };
    };
    GraphQLWalker.prototype.reportFailure = function (node, error) {
        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), "" + error));
    };
    return GraphQLWalker;
}(tslint_1.RuleWalker));
function initSchema(json) {
    var unpackedSchemaJson = json.data ? json.data : json;
    if (!unpackedSchemaJson.__schema) {
        throw new Error("Please pass a valid GraphQL introspection query result.");
    }
    return graphql_1.buildClientSchema(unpackedSchemaJson);
}
function initSchemaFromFile(jsonFile) {
    return initSchema(JSON.parse(fs.readFileSync(jsonFile, "utf8")));
}
function templateExpressionMatchesTag(tagName, node) {
    var tagNameSegments = tagName.split(".").length;
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
    var nameLength = fragment.length;
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
        // 
    }
    else if (env === "lokka" && /\.\.\.\s*$/.test(chunk)) {
        // This is Lokka-style fragment interpolation where you actually type the '...' yourself
        return strWithLen(nameLength + 3);
    }
    else {
        return fragment;
        // throw new Error("Invalid interpolation");
    }
}
function strWithLen(len) {
    // from 
    // http://stackoverflow.com/questions/14343844/create-a-string-of-variable-length-filled-with-a-repeated-character
    return new Array(len + 1).join("x");
}
//# sourceMappingURL=graphqlRule.js.map