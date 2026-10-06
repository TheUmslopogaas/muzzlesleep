---
trigger: always_on
---

# MuzzleSleep Shopify Theme Rules

• This is a Shopify theme project.
• Only modify files relevant to the requested task.
• Do not modify unrelated theme files.
• Before creating or modifying code, inspect the relevant existing files and follow the project's existing conventions.

SECTION DEVELOPMENT
• Generate complete Shopify section files in sections/lt-<name>.liquid.
• Each section must contain its Liquid/HTML, CSS, JavaScript when needed, and {% schema %}.
• Use a div as the section root wrapper.
• Prefix every custom CSS class with lt-.
• Use the existing Shopify page-width class for the main content container where appropriate.
• Desktop first, with responsive behavior at 767px and 480px.
• Use px for sizing, spacing, borders, and other dimensions.
• Use unitless integer values for line-height.
• Do not add unnecessary IDs, dependencies, libraries, or global styles.
• Assume theme.liquid already provides the document structure and global assets.

SHOPIFY CUSTOMIZER
• Content that merchants should reasonably be able to change must be exposed through the Shopify theme editor.
• Use appropriate Shopify schema settings such as image_picker, color, color_background, url, text, textarea, select, checkbox, and range.
• Use color_background for merchant-controlled gradients.
• Use image_picker for merchant-controlled images.
• Provide sensible default values whenever possible.
• Do not hardcode images, links, prices, titles, or other merchant-controlled content when they should be editable.
• Keep the customizer settings organized and practical rather than exposing unnecessary controls.

LIQUID AND SCHEMA VALIDATION
• Use only valid Shopify Liquid syntax and Shopify-supported schema settings.
• Never put unsupported HTML tags such as <br> inside inline_richtext default values.
• Use textarea when merchant-entered line breaks are required.
• Check for unclosed Liquid, HTML, CSS, and JavaScript blocks.
• Check JSON validity in templates and schema.
• Check for undefined Liquid variables and obvious invalid Shopify objects.
• Check that section schemas are valid and can be saved by Shopify.

PRE-PUSH CHECK
Before considering a task complete, inspect only the files created or modified for that task.

Check for:
• Liquid or Shopify schema errors.
• Invalid schema settings or defaults.
• inline_richtext issues.
• Invalid JSON.
• Unclosed tags or blocks.
• Custom classes missing the lt- prefix.
• Excessively long lines or names where applicable.
• Obvious responsive issues at desktop, 767px, and 480px.
• Obvious JavaScript errors.
• Missing required settings or broken links.

If an issue is found, list it and fix it when it is clearly within the task scope. Re-check the affected files after fixing them.

Do not scan the entire theme when checking newly created sections unless explicitly asked.

GIT
• Never commit, push, merge, reset, checkout, or modify Git history unless explicitly instructed.
• Never interpret "done", "save", or "update" as permission to push or commit.