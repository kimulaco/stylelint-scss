import { utils } from "stylelint";
import { namespace, parseSelector } from "../../utils";

export const ruleName = namespace("selector-nest-combinators");

export const messages = utils.ruleMessages(ruleName, {
  expectedInterpolation: `Expected interpolation to be in a nested form`,
  expected: (combinator, type) =>
    `Expected combinator "${combinator}" of type "${type}" to be in a nested form`,
  rejected: `Unexpected nesting found in selector`
});

export default function(expectation) {
  return (root, result) => {
    const validOptions = utils.validateOptions(result, ruleName, {
      actual: expectation,
      possible: ["always", "never"]
    });

    if (!validOptions) {
      return;
    }

    function precedesParentSelector(current) {
      do {
        current = current.next();

        if (current.type === "nesting") {
          return true;
        }
      } while (current.next());

      return false;
    }

    root.walkRules(rule => {
      parseSelector(rule.selector, result, rule, fullSelector => {
        // attribute, class, combinator, comment, id, nesting, pseudo, root, selector, string, tag, or universal
        const chainingTypes = [
          "attribute",
          "class",
          "id",
          "pseudo",
          "tag",
          "universal"
        ];

        const interpolationRe = /#{.+}$/;

        let message;

        fullSelector.walk(node => {
          if (node.value === "}") {
            return;
          }

          if (expectation === "always") {
            if (node.type === "selector") {
              return;
            }

            if (
              node.parent &&
              node.parent.type === "selector" &&
              node.parent.parent &&
              node.parent.parent.type === "pseudo"
            ) {
              return;
            }

            if (!node.prev()) {
              return;
            }

            if (node.next() && precedesParentSelector(node)) {
              return;
            }

            if (node.type === "combinator") {
              if (!chainingTypes.includes(node.next().type)) {
                return;
              }

              if (!chainingTypes.includes(node.prev().type)) {
                return;
              }
            }

            if (
              chainingTypes.includes(node.type) &&
              !chainingTypes.includes(node.prev().type)
            ) {
              return;
            }

            if (
              node.type !== "combinator" &&
              !chainingTypes.includes(node.type)
            ) {
              return;
            }

            const hasInterpolation = interpolationRe.test(rule.selector);

            if (node.type !== "combinator" && hasInterpolation) {
              return;
            }

            if (hasInterpolation) {
              message = messages.expectedInterpolation;
            } else {
              message = messages.expected(node.value, node.type);
            }
          }

          if (expectation === "never") {
            if (rule.parent.type === "root" || rule.parent.type === "atrule") {
              return;
            }

            message = messages.rejected;
          }

          utils.report({
            ruleName,
            result,
            node: rule,
            message,
            index: node.sourceIndex
          });
        });
      });
    });
  };
}
